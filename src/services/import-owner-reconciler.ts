import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { RdClient } from 'src/rd-client/rd-client';
import { ImportOwners } from 'src/services/import-owners';
import { parseCredentials } from 'src/utils/parse-credentials.util';
import { parseOwnerReconcileRecords } from 'src/utils/parse-owner-reconcile-records.util';
import { sourceId } from 'src/utils/source-id.util';
import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import type { ImportOwnerReconcileRecord } from 'src/types/import-owner-reconcile-record';
import type { ImportOwnerReconcileResult } from 'src/types/import-owner-reconcile-result';

/** Bounded owner-only repair. No business records are created and no checkpoint is changed. */
export class ImportOwnerReconciler {
  constructor(
    private core = new CoreApiClient(),
    private metadata = new MetadataApiClient(),
    private sleep = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ) {}

  async run(payload: unknown): Promise<ImportOwnerReconcileResult> {
    const records = parseOwnerReconcileRecords(payload);
    // Same administrator authorization boundary as the import controller.
    await this.metadata.query({
      findOneApplication: {
        __args: { universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER },
        applicationVariables: { key: true, value: true },
      },
    });
    const credentials = parseCredentials(process.env.RD_CREDENTIALS);
    const rd = new RdClient(credentials, async (value) => {
      await this.metadata.mutation({
        updateOneApplicationVariable: {
          __args: { key: 'RD_CREDENTIALS', value: JSON.stringify(value) },
        },
      });
    });
    const owners = new ImportOwners(this.core);
    const result: ImportOwnerReconcileResult = {
      completed: false,
      requests: 0,
      assigned: 0,
      preserved: 0,
      unresolved: 0,
      results: [],
    };
    let nextRequestAt = 0;
    try {
      for (const record of records) {
        const native = await this.read(record);
        const key = native?.rdSourceKey;
        const prefix = `${credentials.accountKey}:${record.kind}:`;
        const external =
          typeof key === 'string' && key.startsWith(prefix)
            ? key.slice(prefix.length)
            : '';
        if (
          !native ||
          typeof key !== 'string' ||
          sourceId(key) !== record.id ||
          !/^[a-zA-Z0-9_-]{1,100}$/.test(external)
        )
          throw new Error('RD_OWNER_RECONCILE_IDENTITY');
        if (native.owner) {
          result.preserved++;
          result.results.push({
            ...record,
            status: 'PRESERVED',
            memberId: native.owner,
          });
          continue;
        }
        let source: Record<string, unknown> | undefined;
        for (let attempt = 0; attempt < 4; attempt++) {
          const wait = Math.max(0, nextRequestAt - Date.now());
          if (wait) await this.sleep(wait);
          nextRequestAt = Date.now() + 850;
          result.requests++;
          try {
            source = (
              await rd.list(`${record.kind}/${external}`, 1, null, true)
            ).records[0];
            break;
          } catch (error) {
            const message = error instanceof Error ? error.message : '';
            if (
              attempt === 3 ||
              !(
                message === 'RD_TOKEN_REFRESHED' ||
                message === 'RD_CONNECTION_FAILED' ||
                message.startsWith('RD_RETRY:')
              )
            )
              throw error;
            nextRequestAt =
              Date.now() +
              (message.startsWith('RD_RETRY:')
                ? Math.max(60_000, Number(message.slice(9)) || 60_000)
                : 850);
          }
        }
        if (!source || (source.id ?? source._id) !== external)
          throw new Error('RD_OWNER_RECONCILE_SOURCE_ID');
        const owner = await owners.forRecord(
          record.kind,
          source,
          credentials.accountKey,
        );
        if (!owner?.memberId) {
          result.unresolved++;
          result.results.push({
            ...record,
            status: 'UNRESOLVED',
            ...(owner ? { sourceOwnerId: owner.sourceId } : {}),
          });
          continue;
        }
        await owners.fillMissing(record.kind, key, owner.memberId);
        const saved = await this.read(record);
        if (saved?.owner === owner.memberId) {
          result.assigned++;
          result.results.push({
            ...record,
            status: 'ASSIGNED',
            sourceOwnerId: owner.sourceId,
            memberId: owner.memberId,
          });
        } else if (saved?.owner) {
          result.preserved++;
          result.results.push({
            ...record,
            status: 'PRESERVED',
            sourceOwnerId: owner.sourceId,
            memberId: saved.owner,
          });
        } else throw new Error('RD_OWNER_RECONCILE_WRITE');
      }
      result.completed = true;
    } catch (error) {
      // Return a known code only. Never expose foreign API bodies, URLs, credentials or customer data.
      const message = error instanceof Error ? error.message : '';
      result.error = /^RD_[A-Z0-9_]+(?:$|[:.])/.test(message)
        ? message.match(/^RD_[A-Z0-9_]+/)![0]
        : 'RD_OWNER_RECONCILE_FAILED';
    }
    return result;
  }

  private async read(record: ImportOwnerReconcileRecord) {
    const table =
      record.kind === 'deals'
        ? 'opportunities'
        : record.kind === 'organizations'
          ? 'companies'
          : 'tasks';
    const field =
      record.kind === 'deals'
        ? 'ownerId'
        : record.kind === 'organizations'
          ? 'accountOwnerId'
          : 'assigneeId';
    const response = (await this.core.query({
      [table]: {
        __args: { first: 1, filter: { id: { eq: record.id } } },
        edges: { node: { id: true, rdSourceKey: true, [field]: true } },
      },
    } as Parameters<CoreApiClient['query']>[0])) as unknown as Record<
      string,
      { edges: { node: Record<string, unknown> }[] }
    >;
    const row = response[table].edges[0]?.node;
    return row
      ? {
          rdSourceKey: row.rdSourceKey,
          owner: typeof row[field] === 'string' ? row[field] : null,
        }
      : null;
  }
}
