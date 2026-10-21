import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportWorker } from '../import-worker';
import type { ImportCoordinator } from '../import-coordinator';
import type { RecordImporter } from '../record-importer';
import type { ImportState } from 'src/types/import-state';
import type { CoreApiClient } from 'twenty-client-sdk/core';
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
