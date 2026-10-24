import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  mutation: vi.fn(),
  metadata: vi.fn(),
  jobs: vi.fn(),
  enqueue: vi.fn(),
  set: vi.fn(),
  get: vi.fn(),
}));
vi.mock('twenty-client-sdk/core', () => ({
  CoreApiClient: class {
    query = mocks.query;
    mutation = mocks.mutation;
  },
}));
vi.mock('twenty-client-sdk/metadata', () => ({
  MetadataApiClient: class {
    query = mocks.metadata;
  },
}));
vi.mock('twenty-sdk/logic-function', () => ({
  enqueueJobs: mocks.enqueue,
  getJobs: mocks.jobs,
  kv: { set: mocks.set, get: mocks.get },
}));
import { ImportCoordinator } from '../import-coordinator';
import type { ImportState } from 'src/types/import-state';
const state = (): ImportState => ({
  id: 'run',
  accountKey: 'acme',
  version: 'v1',
  dryRun: true,
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
  startedAt: '',
  updatedAt: '',
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.metadata.mockResolvedValue({});
  mocks.query.mockResolvedValue({ rdSourceRecords: { edges: [] } });
  mocks.mutation.mockResolvedValue({});
  mocks.jobs.mockResolvedValue([]);
  mocks.get.mockResolvedValue(null);
  process.env.RD_CREDENTIALS = JSON.stringify({
    version: 'v1',
    accountKey: 'acme',
    accessToken: 'SECRET',
  });
});
describe('ImportCoordinator', () => {
  it('requires admin permission even for manually invoked functions', async () => {
    mocks.metadata.mockRejectedValue(new Error('Forbidden'));
    await expect(new ImportCoordinator().control('start')).rejects.toThrow(
      'Forbidden',
    );
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });
  it('never places credentials in the job payload or source record', async () => {
    await new ImportCoordinator().control('simulate');
    expect(JSON.stringify(mocks.enqueue.mock.calls)).not.toContain('SECRET');
    expect(JSON.stringify(mocks.mutation.mock.calls)).not.toContain('SECRET');
  });
  it('uses identical queue IDs for simultaneous first commands', async () => {
    const existing = state();
    mocks.query.mockResolvedValue({
      rdSourceRecords: { edges: [{ node: { sourcePayload: existing } }] },
    });
    await new ImportCoordinator().control('simulate');
    await new ImportCoordinator().control('simulate');
    expect(mocks.enqueue.mock.calls[0][0].jobs[0].jobId).toBe(
      mocks.enqueue.mock.calls[1][0].jobs[0].jobId,
    );
  });
  it('exposes timed-out workers as resumable instead of showing running forever', async () => {
    const existing = state();
    existing.status = 'RUNNING';
    existing.jobId = 'failed';
    mocks.query.mockResolvedValue({
      rdSourceRecords: { edges: [{ node: { sourcePayload: existing } }] },
    });
    mocks.jobs.mockResolvedValue([{ jobId: 'failed', state: 'FAILED' }]);
    expect((await new ImportCoordinator().control('status'))?.status).toBe(
      'FAILED',
    );
  });
  it('does not start a concurrent job when the chain is active', async () => {
    const existing = state();
    existing.jobId = 'active';
    mocks.query.mockResolvedValue({
      rdSourceRecords: { edges: [{ node: { sourcePayload: existing } }] },
    });
    mocks.jobs.mockResolvedValue([{ jobId: 'active', state: 'ACTIVE' }]);
    await new ImportCoordinator().control('resume');
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
  it('requests pause without modifying a running checkpoint', async () => {
    await new ImportCoordinator().control('pause');
    expect(mocks.set).toHaveBeenCalledWith('rd:pause', true);
    expect(mocks.mutation).not.toHaveBeenCalled();
  });
  it('saves a checkpoint before enqueueing its continuation', async () => {
    const existing = state();
    await new ImportCoordinator().enqueueNext(existing, 60000);
    expect(mocks.mutation.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.enqueue.mock.invocationCallOrder[0],
    );
    expect(existing.revision).toBe(1);
    expect(mocks.enqueue.mock.calls[0][0].delayMs).toBeGreaterThanOrEqual(
      59900,
    );
  });
});

it('returns only safe live queue facts and pending pause without foreign failure messages', async () => {
  const existing = { ...state(), status: 'RUNNING' as const, jobId: 'active' };
  mocks.query.mockResolvedValue({
    rdSourceRecords: { edges: [{ node: { sourcePayload: existing } }] },
  });
  mocks.get.mockImplementation(async (key) =>
    key === 'rd:pause' ? true : null,
  );
  mocks.jobs.mockResolvedValue([
    {
      jobId: 'active',
      state: 'ACTIVE',
      attemptsMade: 2,
      failedReason: 'SECRET',
      enqueuedAt: 1,
    },
  ]);
  const result = await new ImportCoordinator().control('status');
  expect(result?.queue).toEqual({ state: 'ACTIVE', attemptsMade: 2 });
  expect(result?.pauseRequested).toBe(true);
  expect(JSON.stringify(result)).not.toContain('SECRET');
  expect(mocks.mutation).not.toHaveBeenCalled();
});
