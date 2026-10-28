import { CoreApiClient } from 'twenty-client-sdk/core';
import type { ImportOwnerMatch } from 'src/types/import-owner-match';
import { sourceId } from 'src/utils/source-id.util';
import { ImportOwnerMappings } from 'src/services/import-owner-mappings';

/** Resolve existing workspace members only. Never invites users or changes access. */
export class ImportOwners {
  private members?: Promise<Map<string, string[]>>;
  private memberDetails = new Map<string, { email: string; name: string }>();
  private mappings: ImportOwnerMappings;
  constructor(
    private client = new CoreApiClient(),
    private catalog?: Record<string, ImportOwnerMatch>,
  ) {
    this.mappings = new ImportOwnerMappings(client);
  }

  async match(
    user: Record<string, unknown>,
    account: string,
  ): Promise<ImportOwnerMatch> {
    const id = String(user.id ?? user._id ?? '');
    const email =
      typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
    const mapped = (await this.mappings.read(account)).get(id);
    const members =
      email || mapped ? await this.memberIndex() : new Map<string, string[]>();
    const ids = mapped
      ? this.memberDetails.has(mapped)
        ? [mapped]
        : []
      : email
        ? (members.get(email) ?? [])
        : [];
    const member =
      ids.length === 1 ? this.memberDetails.get(ids[0]) : undefined;
    return {
      sourceId: id,
      name: String(user.name ?? ''),
      email,
      memberId: ids.length === 1 ? ids[0] : null,
      matchMethod: mapped ? 'explicit' : 'email',
      ...(member ? { memberName: member.name, memberEmail: member.email } : {}),
      status:
        ids.length === 1 ? 'matched' : ids.length ? 'ambiguous' : 'missing',
    };
  }

  async forRecord(
    kind: string,
    record: Record<string, unknown>,
    account: string,
  ) {
    if (!['deals', 'organizations', 'tasks'].includes(kind)) return null;
    const embedded = record.user as Record<string, unknown> | undefined;
    const ids =
      kind === 'tasks'
        ? (record.owner_ids ??
          record.user_ids ?? [record.owner_id ?? record.user_id])
        : [record.owner_id ?? embedded?.id ?? embedded?._id];
    const distinct = [
      ...new Set(
        (Array.isArray(ids) ? ids : []).filter(
          (id): id is string => typeof id === 'string' && Boolean(id),
        ),
      ),
    ];
    // Twenty tasks have one assignee. Multiple RD owners remain in the source snapshot.
    if (distinct.length !== 1) return null;
    const current = this.catalog?.[distinct[0]];
    if (current)
      return this.match(
        {
          id: current.sourceId,
          name: current.name,
          email: current.email,
        },
        account,
      );
    const result = await this.client.query({
      rdSourceRecords: {
        __args: {
          first: 1,
          filter: { sourceKey: { eq: `${account}:users:${distinct[0]}` } },
        },
        edges: { node: { sourcePayload: true } },
      },
    });
    const user = result.rdSourceRecords!.edges[0]?.node.sourcePayload as
      Record<string, unknown> | undefined;
    return user ? this.match(user, account) : null;
  }

  async fillMissing(
    kind: string,
    key: string,
    memberId: string,
  ): Promise<void> {
    // Compare-and-set in one database mutation also preserves a concurrent manual assignment.
    const base = { id: { eq: sourceId(key) }, rdSourceKey: { eq: key } };
    if (kind === 'deals')
      await this.client.mutation({
        updateOpportunities: {
          __args: {
            filter: { ...base, ownerId: { is: 'NULL' } },
            data: { ownerId: memberId },
          },
          id: true,
        },
      });
    else if (kind === 'organizations')
      await this.client.mutation({
        updateCompanies: {
          __args: {
            filter: { ...base, accountOwnerId: { is: 'NULL' } },
            data: { accountOwnerId: memberId },
          },
          id: true,
        },
      });
    else if (kind === 'tasks')
      await this.client.mutation({
        updateTasks: {
          __args: {
            filter: { ...base, assigneeId: { is: 'NULL' } },
            data: { assigneeId: memberId },
          },
          id: true,
        },
      });
  }

  private memberIndex() {
    this.members ??= (async () => {
      const index = new Map<string, string[]>();
      let after: string | undefined;
      for (;;) {
        const result = await this.client.query({
          workspaceMembers: {
            __args: { first: 100, after, orderBy: [{ id: 'AscNullsLast' }] },
            edges: {
              cursor: true,
              node: {
                id: true,
                userEmail: true,
                name: { firstName: true, lastName: true },
              },
            },
            pageInfo: { hasNextPage: true, endCursor: true },
          },
        });
        const page = result.workspaceMembers!;
        for (const { node } of page.edges) {
          const email = node.userEmail?.trim().toLowerCase();
          this.memberDetails.set(node.id, {
            email: email ?? '',
            name: `${node.name?.firstName ?? ''} ${node.name?.lastName ?? ''}`.trim(),
          });
          if (email)
            index.set(email, [
              ...new Set([...(index.get(email) ?? []), node.id]),
            ]);
        }
        if (!page.pageInfo.hasNextPage) return index;
        const cursor = page.pageInfo.endCursor;
        if (!cursor || cursor === after)
          throw new Error(
            'RD_OWNER_MEMBER_PAGE_CHANGED: workspace member pagination did not advance.',
          );
        after = cursor;
      }
    })();
    return this.members;
  }
}
