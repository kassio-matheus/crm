import { expect, it } from 'vitest';
import { appendImportActivity } from '../append-import-activity.util';
import { importState } from 'src/__tests__/fixtures/import-state';
it('retains only the last 40 operational events and never takes record payloads or secrets', () => {
  const state = importState();
  const detail = {
    kind: 'organizations',
    batchSize: 25,
    durationMs: 120,
    token: 'SECRET',
    payload: { name: 'PRIVATE' },
    url: 'https://rd.test?token=SECRET',
  };
  for (let i = 0; i < 45; i++) {
    state.requests = i;
    appendImportActivity(state, 'page', detail, i * 1000);
  }
  expect(state.activity).toHaveLength(40);
  expect(state.activity![0].id).toContain(':5:');
  expect(state.activity![state.activity!.length - 1]).toMatchObject({
    event: 'page',
    kind: 'organizations',
    batchSize: 25,
    dryRun: true,
  });
  expect(JSON.stringify(state.activity)).not.toMatch(/SECRET|PRIVATE|https/);
});
it('deduplicates a retained event without mutating business counters', () => {
  const state = importState();
  appendImportActivity(state, 'paused');
  appendImportActivity(state, 'paused');
  expect(state.activity).toHaveLength(1);
  expect(state.processed).toBe(89);
  expect(state.created).toBe(0);
});
