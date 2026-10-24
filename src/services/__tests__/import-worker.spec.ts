import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportWorker } from '../import-worker';
import type { ImportCoordinator } from '../import-coordinator';
import type { RecordImporter } from '../record-importer';
import type { ImportState } from 'src/types/import-state';
import type { CoreApiClient } from 'twenty-client-sdk/core';
import { sourceId } from 'src/utils/source-id.util';
const mocks = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), set: vi.fn() }));
vi.mock('src/rd-client/rd-client', () => ({
  RdClient: class {
    list = mocks.list;
  },
}));
vi.mock('twenty-sdk/logic-function', () => ({
  kv: { get: mocks.get, set: mocks.set },
  enqueueJobs: vi.fn(),
  getJobs: vi.fn(),
}));
const initial = (): ImportState => ({
  id: 'run',
  accountKey: 'acme',
  version: 'v1',
  dryRun: false,
  status: 'RUNNING',
  phase: 'resources',
  resourceIndex: 1,
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
  startedAt: '',
  updatedAt: '',
});
beforeEach(() => {
  vi.clearAllMocks();
  process.env.RD_CREDENTIALS = JSON.stringify({
    version: 'v1',
    accountKey: 'acme',
    accessToken: 'SECRET',
  });
  mocks.get.mockResolvedValue(null);
  mocks.set.mockResolvedValue(undefined);
});
const setup = (state = initial()) => {
  const save = vi.fn();
  const enqueueNext = vi.fn();
  const read = vi.fn().mockResolvedValue(state);
  const importer = { import: vi.fn().mockResolvedValue('created') };
  const coordinator = { read, save, enqueueNext };
  return {
    state,
    coordinator,
    importer,
    worker: new ImportWorker(
      coordinator as unknown as ImportCoordinator,
      importer as unknown as RecordImporter,
      {} as CoreApiClient,
    ),
  };
};
describe('ImportWorker', () => {
  it('does not run stale queue revisions', async () => {
    const { worker } = setup();
    await worker.run({ revision: 10 });
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it('pauses before issuing another remote request', async () => {
    const { worker, state, coordinator } = setup();
    mocks.get.mockResolvedValue(true);
    await worker.run({});
    expect(state.status).toBe('PAUSED');
    expect(coordinator.save).toHaveBeenCalled();
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it('checkpoints every successful record before advancing a page', async () => {
    const { worker, state, coordinator, importer } = setup();
    mocks.list.mockResolvedValue({
      records: [{ id: '1' }, { id: '2' }],
      hasMore: true,
      next: null,
    });
    await worker.run({});
    expect(importer.import).toHaveBeenCalledTimes(2);
    expect(state.processed).toBe(2);
    expect(state.page).toBe(2);
    expect(coordinator.save.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(coordinator.enqueueNext).toHaveBeenCalled();
  });
  it('keeps the current page when a native write fails', async () => {
    const { worker, state, importer } = setup();
    mocks.list.mockResolvedValue({
      records: [{ id: '1' }, { id: '2' }],
      hasMore: true,
    });
    importer.import
      .mockResolvedValueOnce('created')
      .mockRejectedValueOnce(new Error('SQL request failed token=SECRET'));
    await worker.run({});
    expect(state.status).toBe('FAILED');
    expect(state.page).toBe(1);
    expect(state.processed).toBe(1);
    expect(state.error).not.toContain('SECRET');
    expect(state.revision).toBe(1);
  });
  it('backs off on 429 without advancing the cursor', async () => {
    const { worker, state, coordinator } = setup();
    mocks.list.mockRejectedValue(new Error('RD_RETRY:125000'));
    await worker.run({});
    expect(state.page).toBe(1);
    expect(state.retryCount).toBe(1);
    expect(coordinator.enqueueNext).toHaveBeenCalledWith(state, 125000);
  });
  it('bounds retries across worker revisions', async () => {
    const state = initial();
    state.retryCount = 3;
    const { worker, coordinator } = setup(state);
    mocks.list.mockRejectedValue(new Error('RD_RETRY:60000'));
    await worker.run({});
    expect(state.status).toBe('FAILED');
    expect(coordinator.enqueueNext).not.toHaveBeenCalled();
  });
  it('does not bypass the stored request budget on resume', async () => {
    const state = initial();
    state.nextRequestAt = Date.now() + 30_000;
    const { worker, coordinator } = setup(state);
    await worker.run({});
    expect(mocks.list).not.toHaveBeenCalled();
    expect(coordinator.enqueueNext).toHaveBeenCalled();
  });
  it('rejects changed tenant credentials before any remote request', async () => {
    const state = initial();
    state.accountKey = 'other';
    const { worker } = setup(state);
    await worker.run({});
    expect(state.status).toBe('FAILED');
    expect(mocks.list).not.toHaveBeenCalled();
  });
});

describe('checkpoint consistency', () => {
  it('resumes at the persisted record offset without double-counting', async () => {
    const state = initial();
    state.recordOffset = 1;
    state.processed = 1;
    const { worker, importer } = setup(state);
    mocks.list.mockResolvedValue({
      records: [{ id: '1' }, { id: '2' }],
      hasMore: false,
    });
    await worker.run({});
    expect(importer.import).toHaveBeenCalledTimes(1);
    expect(importer.import.mock.calls[0][1]).toEqual({ id: '2' });
    expect(state.processed).toBe(2);
    expect(state.recordOffset).toBe(0);
  });
  it('refuses a changed page on recovery rather than skipping different records', async () => {
    const state = initial();
    state.pageSignature = 'previous-page';
    state.recordOffset = 1;
    const { worker, importer } = setup(state);
    mocks.list.mockResolvedValue({
      records: [{ id: 'replacement' }],
      hasMore: false,
    });
    await worker.run({});
    expect(state.status).toBe('FAILED');
    expect(state.error).toContain('RD_SOURCE_PAGE_CHANGED');
    expect(importer.import).not.toHaveBeenCalled();
  });
});

describe('bounded dashboard telemetry', () => {
  it('records successful page facts without credentials or source contents', async () => {
    const { worker, state } = setup();
    mocks.list.mockResolvedValue({
      records: [{ id: '1', name: 'PRIVATE' }],
      hasMore: false,
    });
    await worker.run({});
    expect(state.lastBatchSize).toBe(1);
    expect(state.lastRequestDurationMs).toBeGreaterThanOrEqual(0);
    expect(state.activity?.[state.activity.length - 1]).toMatchObject({
      event: 'page',
      kind: 'users',
      page: 1,
      batchSize: 1,
    });
    expect(JSON.stringify(state.activity)).not.toMatch(/PRIVATE|SECRET/);
  });
  it('records retry delays without changing cursors or starting live mode', async () => {
    const { worker, state } = setup({ ...initial(), dryRun: true });
    mocks.list.mockRejectedValue(new Error('RD_RETRY:125000'));
    await worker.run({});
    expect(state.activity?.[state.activity.length - 1]).toMatchObject({
      event: 'retry',
      retryAfterMs: 125000,
      dryRun: true,
    });
    expect(state.page).toBe(1);
    expect(state.created).toBe(0);
  });
});

describe('recent sample and complete date windows', () => {
  const recent = () => ({
    ...initial(),
    version: 'v2' as const,
    dryRun: true,
    resourceIndex: 0,
    plan: ['deals'],
    selection: {
      scope: 'sample' as const,
      limit: 25,
      cutoff: '2026-10-24T00:00:00Z',
      selectedDeals: [] as string[],
    },
  });
  const credentials = () => {
    process.env.RD_CREDENTIALS = JSON.stringify({
      version: 'v2',
      accountKey: 'acme',
      accessToken: 'x',
      refreshToken: 'r',
      clientId: 'c',
      clientSecret: 's',
    });
  };
  const records = () =>
    Array.from({ length: 25 }, (_, index) => ({
      id: `deal-${index}`,
      created_at: new Date(
        Date.UTC(2026, 9, 23, 0, 0, 25 - index),
      ).toISOString(),
    }));
  it('stores exactly the recent selection and never follows the rest of the list', async () => {
    credentials();
    const { worker, state, importer } = setup(recent());
    mocks.list.mockResolvedValue({
      records: records(),
      hasMore: true,
      next: 'older',
    });
    await worker.run({});
    expect(state.selection!.selectedDeals).toHaveLength(25);
    expect(state.counts.deals).toBe(25);
    expect(state.resourceIndex).toBe(1);
    expect(state.nextPath).toBeNull();
    expect(importer.import).toHaveBeenCalledTimes(25);
  });
  it('preserves the complete sample page when resuming from a partial offset', async () => {
    credentials();
    const current = recent();
    current.recordOffset = 10;
    current.counts.deals = 10;
    current.processed = 10;
    const { worker, state, importer } = setup(current);
    mocks.list.mockResolvedValue({
      records: records(),
      hasMore: true,
      next: 'older',
    });
    await worker.run({});
    expect(importer.import).toHaveBeenCalledTimes(15);
    expect(state.counts.deals).toBe(25);
    expect(state.resourceIndex).toBe(1);
  });
  it('starts a new overlapping window before requesting the 10,000-record boundary', async () => {
    credentials();
    const current: ImportState = recent();
    current.dryRun = false;
    current.selection!.scope = 'all';
    current.page = 399;
    const { worker, state } = setup(current);
    mocks.list.mockResolvedValue({
      records: records(),
      hasMore: true,
      next: 'page-400',
    });
    await worker.run({});
    expect(state.page).toBe(1);
    expect(state.nextPath).toBeNull();
    expect(state.selection!.upper).toBe(records()[24].created_at);
    expect(state.resourceIndex).toBe(0);
  });
  it('discards an old command after the user changes import scope', async () => {
    const { worker } = setup(recent());
    await worker.run({ runId: 'old-migration' });
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it('initializes a winning scope proposal in the queued worker and never resets its advanced checkpoint', async () => {
    credentials();
    const previous = {
      ...initial(),
      status: 'COMPLETED' as const,
      version: 'v2' as const,
    };
    const next = {
      ...recent(),
      id: 'winning-run',
      revision: previous.revision + 1,
      plan: ['users'],
    };
    const transitionId = sourceId(
      `scope-transition:${previous.id}:${previous.revision}`,
    );
    const query = vi
      .fn()
      .mockResolvedValue({
        rdSourceRecords: {
          edges: [
            { node: { sourcePayload: { previous, next, action: 'simulate' } } },
          ],
        },
      });
    const save = vi.fn();
    const enqueueNext = vi.fn();
    const read = vi.fn().mockResolvedValue(previous);
    const worker = new ImportWorker(
      { read, save, enqueueNext } as unknown as ImportCoordinator,
      { import: vi.fn() } as unknown as RecordImporter,
      { query } as unknown as CoreApiClient,
    );
    mocks.list.mockResolvedValue({ records: [], hasMore: false, next: null });
    await worker.run({ transitionId, runId: 'winning-run' });
    expect(save.mock.calls[0][0].id).toBe('winning-run');
    expect(mocks.set).toHaveBeenCalledWith('rd:simulation-pipelines', []);
    read.mockResolvedValue({
      ...next,
      status: 'COMPLETED',
      phase: 'done',
      revision: next.revision + 10,
    });
    save.mockClear();
    mocks.list.mockClear();
    await worker.run({ transitionId, runId: 'winning-run' });
    expect(save).not.toHaveBeenCalled();
    expect(mocks.list).not.toHaveBeenCalled();
  });
});
