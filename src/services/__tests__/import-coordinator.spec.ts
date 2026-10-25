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
import type { ImportTransition } from 'src/types/import-transition';
const state = (): ImportState => ({
  id: 'run',
  accountKey: 'acme',
  version: 'v2',
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
    version: 'v2',
    accountKey: 'acme',
    accessToken: 'SECRET',
    clientId: 'client',
    clientSecret: 'SECRET',
    refreshToken: 'SECRET',
  });
});
describe('ImportCoordinator', () => {
  it('uses the same atomic winning transition and queue slot for competing sample and full-import commands', async () => {
    const previous = {
      ...state(),
      status: 'COMPLETED' as const,
      phase: 'done' as const,
      selection: {
        scope: 'sample' as const,
        limit: 25,
        cutoff: '2026-10-24T00:00:00Z',
        selectedDeals: ['one'],
      },
    };
    let retained: ImportTransition | undefined;
    let retainedId: string | undefined;
    mocks.query.mockImplementation(async (request) => ({
      rdSourceRecords: {
        edges: [
          {
            node: {
              sourcePayload:
                request.rdSourceRecords.__args.filter.id.eq === retainedId
                  ? retained
                  : previous,
            },
          },
        ],
      },
    }));
    mocks.mutation.mockImplementation(async (request) => {
      const create = request.createRdSourceRecord?.__args.data;
      if (create?.recordKind === 'scopeTransition') {
        if (retained) throw new Error('unique transition');
        retained = structuredClone(create.sourcePayload);
        retainedId = create.id;
      }
      return {};
    });
    const [sample, full] = await Promise.all([
      new ImportCoordinator().control('sample'),
      new ImportCoordinator().control('start'),
    ]);
    expect(sample?.id).toBe(full?.id);
    expect(mocks.enqueue.mock.calls[0][0].jobs[0].jobId).toBe(
      mocks.enqueue.mock.calls[1][0].jobs[0].jobId,
    );
    expect(mocks.enqueue.mock.calls[0][0].jobs[0].payload.transitionId).toBe(
      retainedId,
    );
    expect(
      mocks.mutation.mock.calls.some(
        ([request]) => request.updateRdSourceRecord,
      ),
    ).toBe(false);
  });
  it('keeps a durable scope proposal recoverable after initialization fails, choosing one fixed retry slot', async () => {
    const previous = {
      ...state(),
      status: 'COMPLETED' as const,
      phase: 'done' as const,
      selection: {
        scope: 'sample' as const,
        limit: 25,
        cutoff: '2026-10-24T00:00:00Z',
        selectedDeals: ['one'],
      },
    };
    mocks.query.mockResolvedValue({
      rdSourceRecords: { edges: [{ node: { sourcePayload: previous } }] },
    });
    mocks.jobs.mockImplementation(async (ids: string[]) =>
      ids[0]?.startsWith('rd-scope-')
        ? [{ jobId: ids[0], state: 'FAILED' }]
        : [],
    );
    await new ImportCoordinator().control('sample');
    expect(mocks.enqueue.mock.calls[0][0].jobs[0].jobId).toMatch(
      /rd-scope-.*-1$/,
    );
    expect(
      mocks.mutation.mock.calls.some(
        ([request]) => request.updateRdSourceRecord,
      ),
    ).toBe(false);
  });
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
  it('does not restart a completed live migration on repeated start, simulate or resume commands', async () => {
    const completed = {
      ...state(),
      dryRun: false,
      status: 'COMPLETED' as const,
      phase: 'done' as const,
    };
    mocks.query.mockResolvedValue({
      rdSourceRecords: { edges: [{ node: { sourcePayload: completed } }] },
    });
    for (const action of ['start', 'simulate', 'resume'] as const)
      expect(await new ImportCoordinator().control(action)).toEqual(completed);
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });
  it('starts complete recent-first reads only after a completed sample and locks cleanup', async () => {
    const existing = {
      ...state(),
      dryRun: false,
      status: 'COMPLETED' as const,
      phase: 'done' as const,
      selection: {
        scope: 'sample' as const,
        limit: 25,
        cutoff: '2026-10-24T00:00:00Z',
        selectedDeals: ['one'],
      },
      preview: {
        runId: 'sample',
        status: 'AVAILABLE' as const,
        owned: 3,
        removed: 0,
      },
    };
    mocks.query.mockResolvedValue({
      rdSourceRecords: { edges: [{ node: { sourcePayload: existing } }] },
    });
    const result = await new ImportCoordinator().control('start');
    expect(result).toMatchObject({
      dryRun: false,
      selection: { scope: 'all' },
      preview: { status: 'PROMOTED' },
      maintenance: 'restore',
    });
    expect(result!.plan!.indexOf('deals')).toBeLessThan(
      result!.plan!.indexOf('organizations'),
    );
    expect(mocks.enqueue).toHaveBeenCalledTimes(1);
  });
  it('refuses sample creation before a recent simulation has completed', async () => {
    mocks.query.mockResolvedValue({
      rdSourceRecords: { edges: [{ node: { sourcePayload: state() } }] },
    });
    await expect(new ImportCoordinator().control('sample')).rejects.toThrow(
      'Finish the recent sample',
    );
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
  it('cannot delete sample records after they are incorporated into a full import', async () => {
    mocks.query.mockResolvedValue({
      rdSourceRecords: {
        edges: [
          {
            node: {
              sourcePayload: {
                ...state(),
                dryRun: false,
                selection: { scope: 'all' },
                preview: { runId: 'sample', status: 'PROMOTED' },
              },
            },
          },
        ],
      },
    });
    await expect(new ImportCoordinator().control('cleanup')).rejects.toThrow(
      'Only records owned',
    );
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
  it('rejects a changed company key before another migration can be queued', async () => {
    mocks.query.mockResolvedValue({
      rdSourceRecords: { edges: [{ node: { sourcePayload: state() } }] },
    });
    process.env.RD_CREDENTIALS = JSON.stringify({
      version: 'v1',
      accountKey: 'another-company',
      accessToken: 'SECRET',
    });
    await expect(new ImportCoordinator().control('simulate')).rejects.toThrow(
      'another company',
    );
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
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

it('allows enlarging a completed native sample without losing its deletion receipts', async () => {
  const previous = {
    ...state(),
    dryRun: false,
    status: 'COMPLETED' as const,
    selection: {
      scope: 'sample' as const,
      limit: 25,
      cutoff: '2026-10-24T00:00:00Z',
      selectedDeals: ['one'],
    },
    preview: {
      runId: 'original-preview',
      status: 'AVAILABLE' as const,
      owned: 93,
      removed: 0,
    },
  };
  mocks.query.mockResolvedValue({
    rdSourceRecords: { edges: [{ node: { sourcePayload: previous } }] },
  });
  const next = await new ImportCoordinator().control('simulate');
  expect(next).toMatchObject({
    dryRun: true,
    selection: { limit: 125 },
    preview: previous.preview,
  });
  expect(mocks.enqueue).toHaveBeenCalledTimes(1);
});

it('repairs orphaned sample views without scheduling another native cleanup', async () => {
  const previous = {
    ...state(),
    dryRun: false,
    status: 'COMPLETED' as const,
    selection: {
      scope: 'sample' as const,
      limit: 125,
      cutoff: '',
      selectedDeals: [],
    },
    preview: {
      runId: 'preview',
      status: 'REMOVED' as const,
      owned: 293,
      removed: 293,
    },
  };
  mocks.query.mockResolvedValue({
    rdSourceRecords: { edges: [{ node: { sourcePayload: previous } }] },
  });
  expect(await new ImportCoordinator().control('cleanup')).toMatchObject({
    maintenance: 'cleanupViews',
    preview: { status: 'CLEANING', removed: 293 },
  });
});
