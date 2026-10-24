import { afterEach, expect, it, vi } from 'vitest';
import { PacedRdReader } from '../paced-rd-reader';
import type { RdClient } from 'src/rd-client/rd-client';
import { importState } from 'src/__tests__/fixtures/import-state';
afterEach(() => vi.useRealTimers());
it('counts dependency requests and persists the shared budget before each GET', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  const state = importState({ requests: 0 });
  state.nextRequestAt = Date.now() + 800;
  const list = vi
    .fn()
    .mockResolvedValue({ records: [], next: null, hasMore: false });
  const save = vi.fn();
  const read = new PacedRdReader(
    { list } as unknown as RdClient,
    state,
    save,
  ).list('organizations/id', 1, null, true);
  expect(list).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(800);
  await read;
  expect(state.requests).toBe(1);
  expect(state.nextRequestAt).toBe(Date.now() + 800);
  expect(save.mock.invocationCallOrder[0]).toBeLessThan(
    list.mock.invocationCallOrder[0],
  );
});
it('does not retry a rejected source request inline', async () => {
  const list = vi.fn().mockRejectedValue(new Error('RD_RETRY:60000'));
  await expect(
    new PacedRdReader(
      { list } as unknown as RdClient,
      importState(),
      vi.fn(),
    ).list('deals'),
  ).rejects.toThrow('RD_RETRY');
  expect(list).toHaveBeenCalledTimes(1);
});
