import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import {
  enqueueJobs,
  getJobs,
  kv,
  type JobStatusResult,
} from 'twenty-sdk/logic-function';
import { IMPORT_WORKER } from 'src/constants/rd-identifiers';
import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import type { ImportState } from 'src/types/import-state';
import { sourceId } from 'src/utils/source-id.util';
import { parseCredentials } from 'src/utils/parse-credentials.util';
import { newRecentImport } from 'src/utils/new-recent-import.util';
import type { ImportAction } from 'src/types/import-action';
import type { ImportTransition } from 'src/types/import-transition';

/** All worker executions share a retained queue ID per checkpoint. Only the worker writes progress. */
export class ImportCoordinator {
  private client = new CoreApiClient();
  private controlId = sourceId('migration-control');

  async read(): Promise<ImportState | null> {
    const result = await this.client.query({
      rdSourceRecords: {
        __args: { first: 1, filter: { id: { eq: this.controlId } } },
        edges: { node: { sourcePayload: true } },
      },
    });
    return (
      (result.rdSourceRecords!.edges[0]?.node
        .sourcePayload as ImportState | null) ?? null
    );
  }

  async save(state: ImportState): Promise<void> {
    state.updatedAt = new Date().toISOString();
    await this.client.mutation({
      updateRdSourceRecord: {
        __args: { id: this.controlId, data: { sourcePayload: state } },
        id: true,
      },
    });
  }

  async control(action: ImportAction): Promise<ImportState | null> {
    // Reading a variable value requires APPLICATIONS on both the app and the person.
    // This checks authorization before any job is enqueued, including for manually executed calls.
    await new MetadataApiClient().query({
      findOneApplication: {
        __args: { universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER },
        applicationVariables: { key: true, value: true },
      },
    });
    let state = await this.read();
    if (action === 'status') {
      if (state && ['READY', 'RUNNING'].includes(state.status)) {
        const latest = await this.latestJob(state);
        state = {
          ...state,
          pauseRequested: Boolean(await kv.get('rd:pause')),
          queue: latest.job
            ? { state: latest.job.state, attemptsMade: latest.job.attemptsMade }
            : undefined,
        };
        if (
          latest.known &&
          (!latest.job || ['FAILED', 'COMPLETED'].includes(latest.job.state))
        )
          return {
            ...state,
            status: 'FAILED',
            error:
              'O processamento parou no último checkpoint. Use Retomar para continuar com segurança.',
          };
      }
      return state;
    }
    if (action === 'pause') {
      await kv.set('rd:pause', true);
      return state;
    }
    const credentials = parseCredentials(process.env.RD_CREDENTIALS);
    if (
      state &&
      (state.accountKey !== credentials.accountKey ||
        state.version !== credentials.version)
    )
      throw new Error(
        'This workspace already has a migration for another company or API version. Keep the original credentials to avoid mixing data.',
      );
    if (!state && action !== 'simulate')
      throw new Error('Run a simulation before starting the migration.');
    if (action === 'start' && state?.dryRun && state.status !== 'COMPLETED')
      throw new Error('Finish the simulation before importing.');
    const active = state ? await this.latestJob(state) : { job: undefined };
    if (active.job && !['COMPLETED', 'FAILED'].includes(active.job.state))
      return state;
    const previous = state;
    let transitionId: string | undefined;
    if (
      action === 'simulate' &&
      state &&
      !state.dryRun &&
      state.selection?.scope !== 'sample'
    ) {
      if (state.status === 'COMPLETED') return state;
      throw new Error('A live migration already exists. Resume it instead.');
    }
    if (action === 'simulate')
      state = newRecentImport(credentials, state, 'sample', true);
    else if (action === 'sample') {
      if (
        !state?.dryRun ||
        state.status !== 'COMPLETED' ||
        state.selection?.scope !== 'sample'
      )
        throw new Error('Finish the recent sample simulation first.');
      state = newRecentImport(credentials, state, 'sample', false);
    } else if (action === 'start' && state?.selection?.scope === 'sample') {
      if (state.status !== 'COMPLETED')
        throw new Error('Finish the recent sample before importing all data.');
      state = newRecentImport(credentials, state, 'all', false);
    } else if (action === 'cleanup' || action === 'cleanupViews') {
      if (action === 'cleanupViews' && state?.preview?.status !== 'REMOVED')
        throw new Error(
          'RD_SAMPLE_NOT_REMOVED: view-only repair requires an already removed sample.',
        );
      if (
        !state ||
        state.selection?.scope !== 'sample' ||
        !state.preview ||
        state.preview.status === 'PROMOTED'
      )
        throw new Error(
          'Only records owned by the recent sample can be removed.',
        );
      if (state.preview.status === 'REMOVED' && state.preview.viewsChecked)
        return state;
      state = {
        ...state,
        maintenance:
          state.preview.status === 'REMOVED' ||
          state.maintenance === 'cleanupViews'
            ? 'cleanupViews'
            : 'cleanup',
        status: 'READY',
        error: null,
        revision: state.revision + 1,
        preview: { ...state.preview, status: 'CLEANING' },
      };
    }
    if (state && previous && state !== previous) {
      // One atomic claim per source checkpoint. Competing scope commands share
      // the winning proposal and queue ID; only that queued worker changes progress.
      const transitionKey = `scope-transition:${previous.id}:${previous.revision}`;
      transitionId = sourceId(transitionKey);
      let transition: ImportTransition = { action, previous, next: state };
      try {
        await this.client.mutation({
          createRdSourceRecord: {
            __args: {
              data: {
                id: transitionId,
                sourceKey: transitionKey,
                recordKind: 'scopeTransition',
                name: 'Migration scope transition and previous checkpoint',
                sourcePayload: transition,
              },
            },
            id: true,
          },
        });
      } catch (error) {
        const found = await this.client.query({
          rdSourceRecords: {
            __args: { first: 1, filter: { id: { eq: transitionId } } },
            edges: { node: { sourcePayload: true } },
          },
        });
        const retained = found.rdSourceRecords!.edges[0]?.node.sourcePayload as
          ImportTransition | undefined;
        if (
          !retained ||
          retained.previous?.id !== previous.id ||
          retained.previous.revision !== previous.revision ||
          retained.next?.accountKey !== previous.accountKey
        )
          throw error;
        transition = retained;
      }
      action = transition.action;
      state = transition.next;
      // A worker may already have initialized or advanced the winning proposal.
      const current = await this.read();
      if (
        current &&
        (current.id !== previous.id || current.revision !== previous.revision)
      ) {
        if (current.id !== state.id) return current;
        state = current;
        transitionId = undefined;
      }
    }
    const needsControlRecord = !previous;
    if (needsControlRecord) {
      const now = new Date().toISOString();
      state ??= {
        id: sourceId(`migration:${credentials.accountKey}`),
        accountKey: credentials.accountKey,
        version: credentials.version,
        dryRun: action !== 'start',
        status: 'READY',
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
        requests: 0,
        retryCount: 0,
        counts: {},
        revision: 0,
        jobId: null,
        nextRequestAt: 0,
        error: null,
        startedAt: now,
        updatedAt: now,
      };
      try {
        // Unique deterministic PK is the atomic first-start guard. Concurrent starts cannot create two sessions.
        await this.client.mutation({
          createRdSourceRecord: {
            __args: {
              data: {
                id: this.controlId,
                sourceKey: 'migration-control',
                recordKind: 'migrationControl',
                name: 'RD Station migration progress',
                sourcePayload: state,
              },
            },
            id: true,
          },
        });
      } catch (error) {
        const existing = await this.read();
        if (!existing) throw error;
        state = existing;
      }
    }
    if (!state) throw new Error('Missing migration checkpoint.');
    const { job } = await this.latestJob(state);
    if (job && !['COMPLETED', 'FAILED'].includes(job.state)) return state;
    if (state.status === 'COMPLETED' && (!state.dryRun || action !== 'start'))
      return state;
    if (action === 'simulate' && !state.dryRun)
      throw new Error('A live migration already exists. Resume it instead.');
    // Duplicate clicks use the same resume ID. A completed/failed queue item is never silently re-enqueued.
    const token = `${state.id}-${state.revision}-${job?.jobId ?? 'initial'}-${job?.attemptsMade ?? 0}`;
    let jobId = `rd-command-${sourceId(token)}`;
    if (transitionId) {
      // Fixed slots do not depend on the mutable command pointer. Two callers
      // racing before enqueue therefore still choose exactly the same queue ID.
      const candidates = Array.from(
        { length: 4 },
        (_, index) => `rd-scope-${transitionId}-${index}`,
      );
      const attempts = await getJobs(candidates);
      const available = candidates.find(
        (id) => !attempts.some((attempt) => attempt.jobId === id),
      );
      if (attempts.some((attempt) => attempt.state !== 'FAILED')) return state;
      if (!available)
        throw new Error(
          'RD_SCOPE_RETRY_LIMIT: the scope change could not be initialized after four attempts. The previous checkpoint was preserved.',
        );
      jobId = available;
    }
    await kv.set('rd:pause', false);
    await kv.set('rd:command-job', jobId);
    await enqueueJobs({
      logicFunctionUniversalIdentifier: IMPORT_WORKER,
      jobs: [
        {
          jobId,
          payload: {
            command:
              action === 'start' && !state.selection ? 'live' : 'continue',
            jobId,
            runId: state.id,
            ...(transitionId ? { transitionId } : {}),
          },
        },
      ],
      delayMs: Math.max(0, state.nextRequestAt - Date.now()),
    });
    return state;
  }

  async enqueueNext(state: ImportState, delayMs = 800): Promise<void> {
    state.revision += 1;
    state.jobId = `rd-${state.id}-${state.dryRun ? 'dry' : 'live'}-${state.revision}`;
    state.nextRequestAt = Math.max(state.nextRequestAt, Date.now() + delayMs);
    await this.save(state);
    // Checkpoint first: a failed enqueue is recoverable from the page without repeating completed records.
    await enqueueJobs({
      logicFunctionUniversalIdentifier: IMPORT_WORKER,
      jobs: [
        {
          jobId: state.jobId,
          payload: { revision: state.revision, runId: state.id },
        },
      ],
      delayMs: Math.max(delayMs, state.nextRequestAt - Date.now()),
    });
  }
  private async latestJob(
    state: ImportState,
  ): Promise<{ known: boolean; job: JobStatusResult | undefined }> {
    const command = await kv.get<string>('rd:command-job');
    const ids = [
      ...new Set(
        [command, state.jobId].filter((id): id is string => Boolean(id)),
      ),
    ];
    const jobs = ids.length ? await getJobs(ids) : [];
    return {
      known: ids.length > 0,
      job: jobs.sort((a, b) => b.enqueuedAt - a.enqueuedAt)[0],
    };
  }
}
