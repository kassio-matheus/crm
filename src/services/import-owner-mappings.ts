import { CoreApiClient } from 'twenty-client-sdk/core';
import { sourceId } from 'src/utils/source-id.util';

/** Explicit, account-scoped admin confirmations. These are not sample-owned records. */
export class ImportOwnerMappings {
  private catalogs = new Map<string, Promise<Map<string, string>>>();
  constructor(private client = new CoreApiClient()) {}

  read(account: string): Promise<Map<string, string>> {
    if (!this.catalogs.has(account))
      this.catalogs.set(account, this.load(account));
    return this.catalogs.get(account)!;
  }

  private async load(account: string) {
    const mappings = new Map<string, string>();
    const prefix = `${account}:owner-mapping:`;
    let after: string | undefined;
    for (;;) {
      const result = await this.client.query({
        rdSourceRecords: {
          __args: {
            first: 100,
            after,
            filter: {
              sourceKey: { startsWith: prefix },
              recordKind: { eq: 'ownerMapping' },
            },
            orderBy: [{ id: 'AscNullsLast' }],
          },
          edges: {
            node: { id: true, sourceKey: true, sourceId: true, targetId: true },
          },
          pageInfo: { hasNextPage: true, endCursor: true },
        },
      });
      const page = result.rdSourceRecords!;
      for (const { node } of page.edges) {
        if (
          !node.sourceId ||
          !node.targetId ||
          node.sourceKey !== `${prefix}${node.sourceId}` ||
          node.id !== sourceId(node.sourceKey)
        )
          throw new Error(
            'RD_OWNER_MAPPING_INVALID: review the confirmed source-to-member mapping.',
          );
        if (mappings.has(node.sourceId))
          throw new Error(
            'RD_OWNER_MAPPING_DUPLICATE: review the confirmed source-to-member mapping.',
          );
        mappings.set(node.sourceId, node.targetId);
      }
      if (!page.pageInfo.hasNextPage) return mappings;
      const cursor = page.pageInfo.endCursor;
      if (!cursor || cursor === after)
        throw new Error('RD_OWNER_MAPPING_PAGE_CHANGED');
      after = cursor;
    }
  }
}
