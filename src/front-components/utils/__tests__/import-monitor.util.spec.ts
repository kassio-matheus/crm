import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ImportMonitor } from '../import-monitor.util';
import { importState } from 'src/__tests__/fixtures/import-state';
import type { ImportMonitorSnapshot } from 'src/types/import-monitor-snapshot';
const execute = vi.fn();
let snapshots: ImportMonitorSnapshot[];
const setup = () =>
  new ImportMonitor(execute, (snapshot) => snapshots.push(snapshot));
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-23T18:02:00Z'));
  vi.clearAllMocks();
  snapshots = [];
  execute.mockResolvedValue(importState());
});
afterEach(() => vi.useRealTimers());
it('polls active progress every 3s, avoids duplicate requests and stops on unmount', async () => {
  const monitor = setup();
  monitor.start();
  await vi.advanceTimersByTimeAsync(0);
  expect(execute).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(3000);
  expect(execute).toHaveBeenCalledTimes(2);
  monitor.stop();
  await vi.advanceTimersByTimeAsync(30_000);
  expect(execute).toHaveBeenCalledTimes(2);
});
it('does not overlap slow status requests or publish late results after unmount', async () => {
  let resolve!: (value: ReturnType<typeof importState>) => void;
  execute.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const monitor = setup();
  monitor.start();
  await monitor.refresh();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(execute).toHaveBeenCalledTimes(1);
  monitor.stop();
  const count = snapshots.length;
  resolve(importState());
  await vi.advanceTimersByTimeAsync(0);
  expect(snapshots).toHaveLength(count);
});
it('preserves last known counters during connection failures and backs off, then recovers', async () => {
  const monitor = setup();
  monitor.start();
  await vi.advanceTimersByTimeAsync(0);
  execute.mockRejectedValueOnce(new Error('SECRET_URL'));
  await vi.advanceTimersByTimeAsync(3000);
  const failed = snapshots[snapshots.length - 1]!;
  expect(failed.state?.processed).toBe(89);
  expect(failed.failures).toBe(1);
  expect(failed.error).not.toContain('SECRET');
  expect(failed.nextPollAt! - Date.now()).toBe(3000);
  await vi.advanceTimersByTimeAsync(3000);
  expect(snapshots[snapshots.length - 1]?.failures).toBe(0);
  monitor.stop();
});
it('keeps paused work paused on page mount and follows explicit resume without a reload', async () => {
  let current = importState({ status: 'PAUSED' });
  execute.mockImplementation(async () => current);
  const monitor = setup();
  monitor.start();
  await vi.advanceTimersByTimeAsync(0);
  expect(execute.mock.calls.map(([action]) => action)).toEqual(['status']);
  await monitor.command('resume');
  expect(snapshots[snapshots.length - 1]?.pendingAction).toBe('resume');
  expect(await monitor.command('resume')).toBe(false);
  current = importState({ status: 'RUNNING', revision: 3, processed: 114 });
  await vi.advanceTimersByTimeAsync(1000);
  expect(snapshots[snapshots.length - 1]?.state?.processed).toBe(114);
  expect(snapshots[snapshots.length - 1]?.pendingAction).toBeNull();
  monitor.stop();
});
it('does not start live import before a completed simulation or retry commands automatically', async () => {
  const monitor = setup();
  monitor.start();
  await vi.advanceTimersByTimeAsync(0);
  expect(await monitor.command('start')).toBe(false);
  execute.mockRejectedValueOnce(new Error('command failed'));
  await monitor.command('pause');
  await vi.advanceTimersByTimeAsync(30_000);
  expect(
    execute.mock.calls.filter(([action]) => action === 'pause'),
  ).toHaveLength(1);
  expect(execute.mock.calls.some(([action]) => action === 'start')).toBe(false);
  monitor.stop();
});
it('reports observed rates only after enough active samples and resets for counter rollbacks', async () => {
  let processed = 0;
  execute.mockImplementation(async () =>
    importState({ processed: (processed += 25) }),
  );
  const monitor = setup();
  monitor.start();
  await vi.advanceTimersByTimeAsync(0);
  expect(snapshots[snapshots.length - 1]?.recordsPerMinute).toBeNull();
  await vi.advanceTimersByTimeAsync(12_000);
  expect(snapshots[snapshots.length - 1]?.recordsPerMinute).toBeGreaterThan(0);
  execute.mockResolvedValue(importState({ processed: 0 }));
  await vi.advanceTimersByTimeAsync(3000);
  expect(snapshots[snapshots.length - 1]?.recordsPerMinute).toBeNull();
  monitor.stop();
});
