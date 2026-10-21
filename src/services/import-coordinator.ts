import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { enqueueJobs, getJobs, kv } from 'twenty-sdk/logic-function';
import { IMPORT_WORKER } from 'src/constants/rd-identifiers';
import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import type { ImportState } from 'src/types/import-state';
import { sourceId } from 'src/utils/source-id.util';
import { parseCredentials } from 'src/utils/parse-credentials.util';

/** All worker executions share a retained queue ID per checkpoint. Only the worker writes progress. */
export class ImportCoordinator {
  private client = new CoreApiClient();
  private controlId = sourceId('migration-control');

  async read(): Promise<ImportState | null> {
    const result = await this.client.query({ rdSourceRecords: { __args: { first: 1, filter: { id: { eq: this.controlId } } }, edges: { node: { sourcePayload: true } } } });
    return result.rdSourceRecords!.edges[0]?.node.sourcePayload as ImportState | null ?? null;
  }

  async save(state: ImportState): Promise<void> {
    state.updatedAt = new Date().toISOString();
    await this.client.mutation({ updateRdSourceRecord: { __args: { id: this.controlId, data: { sourcePayload: state } }, id: true } });
  }

  async control(action: 'status' | 'simulate' | 'start' | 'pause' | 'resume'): Promise<ImportState | null> {
    // Reading a variable value requires APPLICATIONS on both the app and the person.
    // This checks authorization before any job is enqueued, including for manually executed calls.
    await new MetadataApiClient().query({ findOneApplication: { __args: { universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER }, applicationVariables: { key: true, value: true } } });
    let state = await this.read();
    if (action === 'status') {
      if (state && ['READY', 'RUNNING'].includes(state.status)) {
        const id = state.jobId ?? await kv.get<string>('rd:command-job');
        if (id) {
          const jobs = await getJobs([id]);
          if (!jobs.length || ['FAILED', 'COMPLETED'].includes(jobs[0].state)) return { ...state, status: 'FAILED', error: 'O processamento parou no último checkpoint. Use Retomar para continuar com segurança.' };
        }
      }
      return state;
    }
    if (action === 'pause') { await kv.set('rd:pause', true); return state; }
    const credentials = parseCredentials(process.env.RD_CREDENTIALS);
    if (state && (state.accountKey !== credentials.accountKey || state.version !== credentials.version)) throw new Error('This workspace already has a migration for another company or API version. Keep the original credentials to avoid mixing data.');
    if (!state && action !== 'simulate') throw new Error('Run a simulation before starting the migration.');
    if (action === 'start' && state?.dryRun && state.status !== 'COMPLETED') throw new Error('Finish the simulation before importing.');
    if (!state) {
      const now = new Date().toISOString();
      state = { id: sourceId(`migration:${credentials.accountKey}`), accountKey: credentials.accountKey, version: credentials.version, dryRun: action !== 'start', status: 'READY', phase: 'resources', resourceIndex: 0, page: 1, nextPath: null, parentCursor: null, parentId: null, detailIndex: 0, processed: 0, created: 0, skipped: 0, requests: 0, retryCount: 0, counts: {}, revision: 0, jobId: null, nextRequestAt: 0, error: null, startedAt: now, updatedAt: now };
      try {
        // Unique deterministic PK is the atomic first-start guard. Concurrent starts cannot create two sessions.
        await this.client.mutation({ createRdSourceRecord: { __args: { data: { id: this.controlId, sourceKey: 'migration-control', recordKind: 'migrationControl', name: 'RD Station migration progress', sourcePayload: state } }, id: true } });
      } catch (error) { const existing = await this.read(); if (!existing) throw error; state = existing; }
    }
    const lastJob = state.jobId ?? await kv.get<string>('rd:command-job');
    const jobs = lastJob ? await getJobs([lastJob]) : [];
    const job = jobs[0];
    if (job && !['COMPLETED', 'FAILED'].includes(job.state)) return state;
    if (state.status === 'COMPLETED' && (!state.dryRun || action !== 'start')) return state;
    if (action === 'simulate' && !state.dryRun) throw new Error('A live migration already exists. Resume it instead.');
    await kv.set('rd:pause', false);
    // Duplicate clicks use the same resume ID. A completed/failed queue item is never silently re-enqueued.
    const token = `${state.revision}-${job?.jobId ?? 'initial'}-${job?.attemptsMade ?? 0}`;
    const jobId = `rd-command-${sourceId(token)}`;
    await kv.set('rd:command-job', jobId);
    await enqueueJobs({ logicFunctionUniversalIdentifier: IMPORT_WORKER, jobs: [{ jobId, payload: { command: action === 'start' ? 'live' : 'continue' } }], delayMs: Math.max(0, state.nextRequestAt - Date.now()) });
    return state;
  }

  async enqueueNext(state: ImportState, delayMs = 800): Promise<void> {
    state.revision += 1;
    state.jobId = `rd-${state.id}-${state.dryRun ? 'dry' : 'live'}-${state.revision}`;
    state.nextRequestAt = Math.max(state.nextRequestAt, Date.now() + delayMs);
    await this.save(state);
    // Checkpoint first: a failed enqueue is recoverable from the page without repeating completed records.
    await enqueueJobs({ logicFunctionUniversalIdentifier: IMPORT_WORKER, jobs: [{ jobId: state.jobId, payload: { revision: state.revision } }], delayMs: Math.max(delayMs, state.nextRequestAt - Date.now()) });
  }
}
