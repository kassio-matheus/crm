import { CoreApiClient } from 'twenty-client-sdk/core';
import { sourceId } from 'src/utils/source-id.util';
import { importNativeTarget } from 'src/utils/import-native-target.util';
import type { PreviewOwnedRecord } from 'src/types/preview-owned-record';

/** Durable pre-create ownership receipts. No names, fuzzy matching, arbitrary IDs or destroy mutations. */
export class ImportPreviewLedger {
  constructor(
    private runId: string,
    private account: string,
    private core = new CoreApiClient(),
  ) {}
  private prefix() {
    return `preview:${this.runId}:`;
  }
  client(): CoreApiClient {
    return {
      query: this.core.query.bind(this.core),
      mutation: async (request: Parameters<CoreApiClient['mutation']>[0]) => {
        for (const [name, input] of Object.entries(request)) {
          if (!name.startsWith('create') || name === 'createRdSourceRecord')
            continue;
          const data = (
            input as { __args?: { data?: Record<string, unknown> } }
          ).__args?.data;
          const tables = [
            'companies',
            'people',
            'opportunities',
            'tasks',
            'notes',
            'taskTargets',
            'noteTargets',
            'attachments',
            'salesPipelines',
            'salesStages',
          ];
          const target = tables
            .map(importNativeTarget)
            .find((item) => item.create === name);
          if (!target || !data || typeof data.id !== 'string')
            throw new Error('RD_INVALID_PREVIEW_TARGET');
          const key = target.keyField ? data[target.keyField] : null;
          if (
            target.keyField &&
            (typeof key !== 'string' ||
              !key.startsWith(`${this.account}:`) ||
              sourceId(key) !== data.id)
          )
            throw new Error('RD_INVALID_PREVIEW_TARGET');
          await this.claim({
            table: target.table,
            id: data.id,
            key: typeof key === 'string' ? key : null,
            deleted: false,
          });
        }
        return this.core.mutation(request);
      },
    } as CoreApiClient;
  }
  private async claim(owned: PreviewOwnedRecord) {
    const sourceKey = `${this.prefix()}${owned.table}:${owned.id}`;
    const id = sourceId(sourceKey);
    const found = await this.core.query({
      rdSourceRecords: {
        __args: { first: 1, filter: { id: { eq: id } } },
        edges: { node: { id: true } },
      },
    });
    if (!found.rdSourceRecords!.edges.length)
      await this.core.mutation({
        createRdSourceRecord: {
          __args: {
            data: {
              id,
              sourceKey,
              recordKind: 'previewOwnership',
              name: 'Recent sample ownership',
              sourcePayload: owned,
              importRunId: this.runId,
            },
          },
          id: true,
        },
      });
  }
  async entries() {
    const result: { receiptId: string; owned: PreviewOwnedRecord }[] = [];
    let after: string | undefined;
    for (;;) {
      const page = await this.core.query({
        rdSourceRecords: {
          __args: {
            first: 100,
            after,
            filter: {
              sourceKey: { startsWith: this.prefix() },
              recordKind: { eq: 'previewOwnership' },
            },
            orderBy: [{ id: 'AscNullsLast' }],
          },
          edges: { cursor: true, node: { id: true, sourcePayload: true } },
        },
      });
      const edges = page.rdSourceRecords!.edges;
      for (const edge of edges) {
        const owned = edge.node.sourcePayload as PreviewOwnedRecord;
        importNativeTarget(owned.table);
        if (
          typeof owned.id !== 'string' ||
          edge.node.id !==
            sourceId(`${this.prefix()}${owned.table}:${owned.id}`)
        )
          throw new Error('RD_INVALID_PREVIEW_RECEIPT');
        result.push({ receiptId: edge.node.id, owned });
      }
      if (edges.length < 100) return result;
      after = edges[edges.length - 1].cursor;
    }
  }
  private async active(owned: PreviewOwnedRecord) {
    const target = importNativeTarget(owned.table);
    const response = (await this.core.query({
      [target.table]: {
        __args: { first: 1, filter: { id: { eq: owned.id } } },
        edges: {
          node: {
            id: true,
            ...(target.keyField ? { [target.keyField]: true } : {}),
          },
        },
      },
    } as Parameters<CoreApiClient['query']>[0])) as unknown as Record<
      string,
      { edges: { node: Record<string, unknown> }[] }
    >;
    const row = response[target.table].edges[0]?.node;
    if (row && target.keyField && row[target.keyField] !== owned.key)
      throw new Error(
        'RD_PREVIEW_OWNERSHIP_CHANGED: a sample reference changed. No unrelated record was deleted.',
      );
    return row;
  }
  private async guardReferences(
    owned: PreviewOwnedRecord,
    all: PreviewOwnedRecord[],
  ) {
    const refs: Record<string, [string, string][]> = {
      companies: [
        ['people', 'companyId'],
        ['opportunities', 'companyId'],
      ],
      people: [['opportunities', 'pointOfContactId']],
      opportunities: [
        ['taskTargets', 'targetOpportunityId'],
        ['noteTargets', 'targetOpportunityId'],
        ['attachments', 'targetOpportunityId'],
      ],
      tasks: [['taskTargets', 'taskId']],
      notes: [['noteTargets', 'noteId']],
      salesPipelines: [
        ['salesStages', 'salesPipelineId'],
        ['opportunities', 'salesPipelineId'],
      ],
      salesStages: [['opportunities', 'salesStageId']],
    };
    for (const [table, field] of refs[owned.table] ?? []) {
      const ownIds = all
        .filter((item) => item.table === table)
        .map((item) => item.id);
      const result = (await this.core.query({
        [table]: {
          __args: {
            first: 1,
            filter: {
              [field]: { eq: owned.id },
              ...(ownIds.length ? { not: { id: { in: ownIds } } } : {}),
            },
          },
          edges: { node: { id: true } },
        },
      } as Parameters<CoreApiClient['query']>[0])) as unknown as Record<
        string,
        { edges: unknown[] }
      >;
      if (result[table].edges.length)
        throw new Error(
          'RD_PREVIEW_IN_USE: a record outside the sample now depends on these data. Review its relationships before removing the sample.',
        );
    }
  }
  async cleanup(progress: (removed: number, total: number) => Promise<void>) {
    const entries = await this.entries();
    // Preflight all external relationships before the first soft deletion.
    for (const { owned } of entries)
      if (await this.active(owned))
        await this.guardReferences(
          owned,
          entries.map((item) => item.owned),
        );
    const order = [
      'attachments',
      'taskTargets',
      'noteTargets',
      'notes',
      'tasks',
      'opportunities',
      'people',
      'companies',
      'salesStages',
      'salesPipelines',
    ];
    entries.sort(
      (a, b) => order.indexOf(a.owned.table) - order.indexOf(b.owned.table),
    );
    let removed = 0;
    for (const entry of entries) {
      const target = importNativeTarget(entry.owned.table);
      // Persist intent first: recovery can restore even if interruption follows soft deletion.
      entry.owned.deleted = true;
      await this.core.mutation({
        updateRdSourceRecord: {
          __args: { id: entry.receiptId, data: { sourcePayload: entry.owned } },
          id: true,
        },
      });
      if (await this.active(entry.owned))
        await this.core.mutation({
          [target.remove]: { __args: { id: entry.owned.id }, id: true },
        } as Parameters<CoreApiClient['mutation']>[0]);
      removed += 1;
      await progress(removed, entries.length);
    }
  }
  async restore() {
    const entries = await this.entries();
    const order = [
      'salesPipelines',
      'salesStages',
      'companies',
      'people',
      'opportunities',
      'tasks',
      'notes',
      'taskTargets',
      'noteTargets',
      'attachments',
    ];
    entries.sort(
      (a, b) => order.indexOf(a.owned.table) - order.indexOf(b.owned.table),
    );
    for (const entry of entries)
      if (entry.owned.deleted) {
        const target = importNativeTarget(entry.owned.table);
        if (!(await this.active(entry.owned)))
          await this.core.mutation({
            [target.restore]: { __args: { id: entry.owned.id }, id: true },
          } as Parameters<CoreApiClient['mutation']>[0]);
        entry.owned.deleted = false;
        await this.core.mutation({
          updateRdSourceRecord: {
            __args: {
              id: entry.receiptId,
              data: { sourcePayload: entry.owned },
            },
            id: true,
          },
        });
      }
  }
}
