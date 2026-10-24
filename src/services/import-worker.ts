import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { kv } from 'twenty-sdk/logic-function';
import { ImportCoordinator } from 'src/services/import-coordinator';
import { RecordImporter } from 'src/services/record-importer';
import { RdClient } from 'src/rd-client/rd-client';
import { sourceId } from 'src/utils/source-id.util';
import { parseCredentials } from 'src/utils/parse-credentials.util';
import { rdImportResources } from 'src/utils/rd-import-resources.util';
import { appendImportActivity } from 'src/utils/append-import-activity.util';
import type { ImportState } from 'src/types/import-state';

export class ImportWorker {
  constructor(
    private coordinator = new ImportCoordinator(),
    private importer = new RecordImporter(),
    private core = new CoreApiClient(),
  ) {}

  async run(payload: {
    revision?: number;
    command?: 'live' | 'continue';
    jobId?: string;
  }): Promise<void> {
    const state = await this.coordinator.read();
    if (
      !state ||
      (payload.revision !== undefined && state.revision !== payload.revision)
    )
      return;
    if (payload.jobId) state.jobId = payload.jobId;
    if (await kv.get<boolean>('rd:pause')) {
      state.status = 'PAUSED';
      appendImportActivity(state, 'paused');
      await this.coordinator.save(state);
      return;
    }
    if (payload.command === 'live' && state.dryRun) {
      if (state.status !== 'COMPLETED' && state.status !== 'READY')
        throw new Error('Finish the simulation before importing.');
      Object.assign(state, {
        dryRun: false,
        phase: 'resources',
        resourceIndex: 0,
        page: 1,
        recordOffset: 0,
        pageSignature: null,
        nextPath: null,
        parentCursor: null,
        parentId: null,
        detailIndex: 0,
        processed: 0,
        created: 0,
        skipped: 0,
        counts: {},
        error: null,
      });
    }
    if (state.phase === 'done') return;
    if (payload.command) appendImportActivity(state, 'resumed');
    state.status = 'RUNNING';
    state.error = null;
    try {
      const credentials = parseCredentials(process.env.RD_CREDENTIALS);
      if (
        credentials.accountKey !== state.accountKey ||
        credentials.version !== state.version
      )
        throw new Error('Credentials no longer match this migration.');
      const rd = new RdClient(credentials, async (value) => {
        await new MetadataApiClient().mutation({
          updateOneApplicationVariable: {
            __args: { key: 'RD_CREDENTIALS', value: JSON.stringify(value) },
          },
        });
      });
      const work = await this.work(state, Boolean(credentials.legacyToken));
      if (!work) {
        state.phase = 'done';
        state.status = 'COMPLETED';
        appendImportActivity(state, 'completed');
        await this.coordinator.save(state);
        return;
      }
      // A worker issues one RD list request. 800ms between requests leaves margin below 120/min.
      if (Date.now() < state.nextRequestAt) {
        await this.coordinator.enqueueNext(
          state,
          state.nextRequestAt - Date.now(),
        );
        return;
      }
      state.requests += 1;
      state.nextRequestAt = Date.now() + 800;
      await this.coordinator.save(state);
      const source = work.legacy
        ? new RdClient(
            {
              ...credentials,
              version: 'v1',
              accessToken: credentials.legacyToken!,
            },
            async () => {},
          )
        : rd;
      const requestStartedAt = Date.now();
      state.lastRequestAt = new Date(requestStartedAt).toISOString();
      const page = await source.list(
        work.path,
        state.page,
        state.nextPath,
        work.single,
      );
      state.lastRequestDurationMs = Math.max(0, Date.now() - requestStartedAt);
      state.lastBatchSize = page.records.length;
      state.retryCount = 0;
      const signature = sourceId(
        JSON.stringify(
          page.records.map(
            (record) => record.id ?? record._id ?? record.user_id,
          ),
        ),
      );
      if (state.pageSignature && state.pageSignature !== signature)
        throw new Error(
          'RD_SOURCE_PAGE_CHANGED: the source page changed during recovery. Keep the source read-only and review this page before continuing.',
        );
      state.pageSignature = signature;
      await this.coordinator.save(state);
      let offset = state.recordOffset ?? 0;
      if (offset > page.records.length)
        throw new Error(
          'RD_SOURCE_PAGE_CHANGED: the recovered offset is outside the current page.',
        );
      // Cursor advancement only follows a fully persisted page. Partial writes are create-only on replay.
      for (; offset < page.records.length; offset += 1) {
        const record = page.records[offset];
        const result = await this.importer.import(
          work.kind,
          record,
          state.accountKey,
          state.id,
          state.dryRun,
          state.parentId ?? '',
        );
        state.processed += 1;
        state[result] += 1;
        state.counts[work.kind] = (state.counts[work.kind] ?? 0) + 1;
        state.recordOffset = offset + 1;
        await this.coordinator.save(state);
      }
      // Pipelines are the only simulation discovery list; no business records are written during simulation.
      if (state.dryRun && work.kind === 'pipelines') {
        const ids = (await kv.get<string[]>('rd:simulation-pipelines')) ?? [];
        await kv.set('rd:simulation-pipelines', [
          ...new Set([
            ...ids,
            ...page.records.map((r) => String(r.id ?? r._id)),
          ]),
        ]);
      }
      appendImportActivity(state, 'page', {
        kind: work.kind,
        batchSize: page.records.length,
        durationMs: state.lastRequestDurationMs,
      });
      state.recordOffset = 0;
      state.pageSignature = null;
      if (page.hasMore) {
        state.page += 1;
        state.nextPath = page.next;
      } else {
        state.page = 1;
        state.nextPath = null;
        if (state.phase === 'resources') {
          state.resourceIndex += 1;
          if (work.kind === 'pipelines') {
            state.phase = 'pipelineDetails';
            state.parentCursor = null;
            state.parentId = null;
          }
        } else {
          state.detailIndex += 1;
        }
      }
      await this.coordinator.enqueueNext(state);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (
        message === 'RD_TOKEN_REFRESHED' ||
        message === 'RD_CONNECTION_FAILED' ||
        message.startsWith('RD_RETRY:')
      ) {
        // Bounded automatic retry: the same source page is retained, never advanced on an error.
        const attempts = ++state.retryCount;
        if (attempts <= 3) {
          appendImportActivity(state, 'retry', {
            retryAfterMs: message.startsWith('RD_RETRY:')
              ? Number(message.slice(9))
              : 60_000,
          });
          await this.coordinator.enqueueNext(
            state,
            message.startsWith('RD_RETRY:') ? Number(message.slice(9)) : 60_000,
          );
          return;
        }
      }
      state.status = 'FAILED';
      appendImportActivity(state, 'failed');
      state.revision += 1;
      // Do not return foreign response bodies, request URLs, stack traces, or credentials to the UI/logs.
      state.error =
        /^(RD_|Missing |Invalid source|Unsupported RD|Unsafe pagination|Unexpected RD|Credentials |Save the RD)/.test(
          message,
        )
          ? message.slice(0, 350)
          : 'Import stopped at a safe checkpoint. Inspect the failed resource and resume after correcting access or data.';
      await this.coordinator.save(state);
    }
  }

  private async work(
    state: ImportState,
    includeLegacyActivities = false,
  ): Promise<{
    path: string;
    kind: string;
    legacy?: boolean;
    single?: boolean;
  } | null> {
    const resources = rdImportResources(state.version);
    if (state.phase === 'resources') {
      if (state.resourceIndex >= resources.length) {
        state.phase = 'dealDetails';
        state.parentId = null;
        state.parentCursor = null;
        state.detailIndex = 0;
        return this.work(state, includeLegacyActivities);
      }
      const path = resources[state.resourceIndex];
      const name = path.split('?')[0];
      return { path, kind: name === 'deal_pipelines' ? 'pipelines' : name };
    }
    const isPipeline = state.phase === 'pipelineDetails';
    const details = isPipeline
      ? ['stages']
      : state.version === 'v1'
        ? ['contacts', 'deal_products', 'activities']
        : [
            'products',
            'files',
            'proposals',
            ...(includeLegacyActivities ? ['activities', 'legacy-detail'] : []),
          ];
    if (state.parentId && state.detailIndex >= details.length) {
      state.parentId = null;
      state.detailIndex = 0;
    }
    if (!state.parentId) {
      if (state.dryRun) {
        if (!isPipeline) return null;
        const ids = (await kv.get<string[]>('rd:simulation-pipelines')) ?? [];
        const offset = Number(state.parentCursor ?? 0);
        state.parentId = ids[offset] ?? null;
        state.parentCursor = String(offset + 1);
      } else {
        const result = await this.core.query({
          rdSourceRecords: {
            __args: {
              first: 1,
              after: state.parentCursor,
              filter: {
                recordKind: { eq: isPipeline ? 'pipelines' : 'deals' },
                sourceKey: { startsWith: `${state.accountKey}:` },
              },
              orderBy: [{ id: 'AscNullsLast' }],
            },
            edges: { cursor: true, node: { sourceId: true } },
          },
        });
        const edge = result.rdSourceRecords!.edges[0];
        state.parentId = edge?.node.sourceId ?? null;
        state.parentCursor = edge?.cursor ?? state.parentCursor;
      }
      if (!state.parentId) {
        if (!isPipeline) return null;
        state.phase = 'resources';
        state.parentCursor = null;
        state.detailIndex = 0;
        return this.work(state, includeLegacyActivities);
      }
    }
    const parent = encodeURIComponent(state.parentId);
    const detail = details[state.detailIndex];
    if (isPipeline)
      return {
        path:
          state.version === 'v1'
            ? `deal_stages?deal_pipeline_id=${parent}`
            : `pipelines/${parent}/stages`,
        kind: 'stages',
      };
    if (detail === 'activities')
      return {
        path: `activities?deal_id=${parent}`,
        kind: 'activities',
        legacy: state.version === 'v2',
      };
    if (detail === 'legacy-detail')
      return {
        path: `deals/${parent}`,
        kind: 'deal-history',
        legacy: true,
        single: true,
      };
    return { path: `deals/${parent}/${detail}`, kind: `deal-${detail}` };
  }
}
