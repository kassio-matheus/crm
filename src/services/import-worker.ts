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
import { advanceSourceWindow } from 'src/utils/advance-source-window.util';
import { PacedRdReader } from 'src/services/paced-rd-reader';
import { ImportDependencies } from 'src/services/import-dependencies';
import { ImportOwners } from 'src/services/import-owners';
import { ImportPreviewLedger } from 'src/services/import-preview-ledger';
import type { ImportTransition } from 'src/types/import-transition';
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
    runId?: string;
    transitionId?: string;
  }): Promise<void> {
    let state = await this.coordinator.read();
    if (payload.transitionId) {
      const result = await this.core.query({
        rdSourceRecords: {
          __args: { first: 1, filter: { id: { eq: payload.transitionId } } },
          edges: { node: { sourcePayload: true } },
        },
      });
      const transition = result.rdSourceRecords!.edges[0]?.node
        .sourcePayload as ImportTransition | undefined;
      if (
        !transition ||
        !state ||
        payload.runId !== transition.next?.id ||
        transition.previous?.accountKey !== state.accountKey ||
        transition.next.accountKey !== state.accountKey ||
        transition.next.version !== state.version ||
        payload.transitionId !==
          sourceId(
            `scope-transition:${transition.previous.id}:${transition.previous.revision}`,
          )
      )
        throw new Error('RD_INVALID_SCOPE_TRANSITION');
      if (
        state.id === transition.previous.id &&
        state.revision === transition.previous.revision
      ) {
        state = transition.next;
        await this.coordinator.save(state);
      } else if (state.id !== transition.next.id) return;
    }
    if (
      !state ||
      (payload.runId !== undefined && payload.runId !== state.id) ||
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
    if (payload.command === 'live' && state.dryRun && !state.selection) {
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
    if (state.phase === 'done' && !state.maintenance) return;
    if (payload.command) appendImportActivity(state, 'resumed');
    state.status = 'RUNNING';
    state.error = null;
    try {
      if (
        state.selection?.scope === 'sample' &&
        state.dryRun &&
        state.phase === 'resources' &&
        state.resourceIndex === 0 &&
        state.page === 1 &&
        state.processed === 0
      )
        await kv.set('rd:simulation-pipelines', []);
      if (state.maintenance && state.preview) {
        const ledger = new ImportPreviewLedger(
          state.preview.runId,
          state.accountKey,
          this.core,
        );
        if (
          state.maintenance === 'cleanup' ||
          state.maintenance === 'cleanupViews'
        ) {
          if (state.maintenance === 'cleanupViews')
            state.preview.viewsRemoved = await ledger.cleanupViews();
          else
            state.preview.viewsRemoved = await ledger.cleanup(
              async (removed, total) => {
                state.preview!.removed = removed;
                state.preview!.owned = total;
                await this.coordinator.save(state);
              },
            );
          state.preview.viewsChecked = true;
          state.preview.status = 'REMOVED';
          state.maintenance = undefined;
          state.status = 'COMPLETED';
          await this.coordinator.save(state);
          return;
        }
        if (state.maintenance !== 'restore')
          throw new Error(
            'RD_INVALID_MAINTENANCE: no data operation was executed.',
          );
        await ledger.restore();
        state.maintenance = undefined;
        await this.coordinator.save(state);
      }
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
      if (!state.selection) {
        state.requests += 1;
        state.nextRequestAt = Date.now() + 800;
        await this.coordinator.save(state);
      }
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
      const reader = new PacedRdReader(source, state, () =>
        this.coordinator.save(state),
      );
      const ledger =
        state.selection?.scope === 'sample' && !state.dryRun && state.preview
          ? new ImportPreviewLedger(
              state.preview.runId,
              state.accountKey,
              this.core,
            )
          : null;
      const importer = ledger
        ? new RecordImporter(ledger.client())
        : this.importer;
      if (state.owners) importer.withOwnerCatalog?.(state.owners);
      if (state.customFields)
        importer.withCustomCatalog?.(Object.values(state.customFields));
      const dependencies = state.selection
        ? new ImportDependencies(reader, importer, state, this.core)
        : null;
      const windowed = Boolean(
        state.selection &&
        ['deals', 'organizations', 'contacts'].includes(work.path),
      );
      let path = work.path;
      if (
        state.selection?.scope === 'sample' &&
        !state.dryRun &&
        work.path === 'deals'
      ) {
        if (!state.selection.selectedDeals.length) {
          state.resourceIndex += 1;
          await this.coordinator.enqueueNext(state);
          return;
        }
        if (
          state.selection.selectedDeals.some(
            (id) => !/^[a-zA-Z0-9_-]{1,100}$/.test(id),
          )
        )
          throw new Error('Invalid source sample ID.');
        path = `deals?${new URLSearchParams({ filter: `id:(${state.selection.selectedDeals.join(',')})` })}`;
      }
      const requestStartedAt = Date.now();
      state.lastRequestAt = new Date(requestStartedAt).toISOString();
      const page = await (state.selection ? reader : source).list(
        path,
        state.page,
        state.nextPath,
        work.single,
        state.selection
          ? {
              ...(windowed
                ? {
                    sort: 'created_at' as const,
                    upper: state.selection.upper ?? state.selection.cutoff,
                  }
                : work.kind === 'tasks'
                  ? { sort: 'updated_at' as const }
                  : {}),
              ...(state.selection.scope === 'sample' && work.kind === 'tasks'
                ? { size: 5 }
                : {}),
            }
          : undefined,
      );
      if (windowed)
        advanceSourceWindow(state.selection!, page.records, 0, false);
      if (state.selection?.scope === 'sample' && work.kind === 'deals') {
        page.records = page.records.slice(
          0,
          Math.max(
            0,
            state.selection.limit -
              (state.counts.deals ?? 0) +
              state.recordOffset,
          ),
        );
        if (state.dryRun)
          state.selection.selectedDeals = [
            ...new Set([
              ...state.selection.selectedDeals,
              ...page.records.map((record) => String(record.id ?? record._id)),
            ]),
          ];
        if (
          (state.counts.deals ?? 0) +
            page.records.length -
            state.recordOffset >=
          state.selection.limit
        )
          page.hasMore = false;
      }
      if (state.selection?.scope === 'sample' && work.kind === 'tasks')
        page.hasMore = false;
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
      const owners = new ImportOwners(this.core);
      let offset = state.recordOffset ?? 0;
      if (offset > page.records.length)
        throw new Error(
          'RD_SOURCE_PAGE_CHANGED: the recovered offset is outside the current page.',
        );
      // Cursor advancement only follows a fully persisted page. Partial writes are create-only on replay.
      for (; offset < page.records.length; offset += 1) {
        const record = page.records[offset];
        if (state.selection && work.kind === 'custom_fields') {
          if (record.entity === 'deal' && typeof record.slug === 'string') {
            state.customFields ??= {};
            state.customFields[String(record.id)] =
              record as import('src/types/rd-custom-field').RdCustomField;
          }
        }
        if (state.selection && work.kind === 'users') {
          const match = await owners.match(record, state.accountKey);
          state.owners ??= {};
          if (match.sourceId) state.owners[match.sourceId] = match;
        }
        if (dependencies) await dependencies.ensure(work.kind, record);
        const result = await importer.import(
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
      if (ledger && state.preview)
        state.preview.owned = (await ledger.entries()).length;
      if (
        page.hasMore &&
        windowed &&
        state.selection?.scope === 'all' &&
        advanceSourceWindow(
          state.selection,
          page.records,
          state.page,
          page.hasMore,
        )
      ) {
        state.page = 1;
        state.nextPath = null;
      } else if (page.hasMore) {
        state.page += 1;
        state.nextPath = page.next;
      } else {
        state.page = 1;
        state.nextPath = null;
        if (state.phase === 'resources') {
          if (state.selection) {
            state.selection.upper = undefined;
            state.selection.boundary = undefined;
          }
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
    const resources = state.plan ?? rdImportResources(state.version);
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
      : state.selection?.scope === 'sample'
        ? ['sample-tasks']
        : state.version === 'v1'
          ? ['contacts', 'deal_products', 'activities']
          : [
              'products',
              'files',
              'proposals',
              ...(includeLegacyActivities
                ? ['activities', 'legacy-detail']
                : []),
            ];
    if (state.parentId && state.detailIndex >= details.length) {
      state.parentId = null;
      state.detailIndex = 0;
    }
    if (!state.parentId) {
      if (!isPipeline && state.selection?.scope === 'sample' && !state.dryRun) {
        const offset = Number(state.parentCursor ?? 0);
        state.parentId = state.selection.selectedDeals[offset] ?? null;
        state.parentCursor = String(offset + 1);
      } else if (state.dryRun) {
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
    if (detail === 'sample-tasks')
      return {
        path: `tasks?${new URLSearchParams({ filter: `deal_id:${state.parentId}` })}`,
        kind: 'tasks',
      };
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
