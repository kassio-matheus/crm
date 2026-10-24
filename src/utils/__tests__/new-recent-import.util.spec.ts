import { expect, it } from 'vitest';
import { newRecentImport } from '../new-recent-import.util';
import { importState } from 'src/__tests__/fixtures/import-state';
const credentials = {
  version: 'v2' as const,
  accountKey: 'acme',
  accessToken: 'x',
};
it('starts a new bounded recent simulation without reusing legacy resource indexes', () => {
  const old = importState({ page: 401, processed: 10064, status: 'FAILED' });
  const state = newRecentImport(credentials, old, 'sample', true);
  expect(state).toMatchObject({
    page: 1,
    processed: 0,
    dryRun: true,
    selection: { scope: 'sample', limit: 125 },
  });
  expect(old.page).toBe(401);
  expect(state.revision).toBeGreaterThan(old.revision);
});
it('keeps the exact simulated selection and cutoff for native sample creation', () => {
  const dry = newRecentImport(credentials, null, 'sample', true);
  dry.selection!.selectedDeals = ['a', 'b'];
  const live = newRecentImport(credentials, dry, 'sample', false);
  expect(live.selection!.selectedDeals).toEqual(['a', 'b']);
  expect(live.selection!.cutoff).toBe(dry.selection!.cutoff);
  expect(live.preview?.runId).toBe(dry.id);
});
it('locks sample cleanup and schedules restore before a complete import', () => {
  const sample = newRecentImport(
    credentials,
    newRecentImport(credentials, null, 'sample', true),
    'sample',
    false,
  );
  sample.preview!.status = 'REMOVED';
  const full = newRecentImport(credentials, sample, 'all', false);
  expect(full).toMatchObject({
    dryRun: false,
    selection: { scope: 'all' },
    preview: { status: 'PROMOTED' },
    maintenance: 'restore',
  });
});
it('refuses unsupported v1 complete-filter guarantees', () =>
  expect(() =>
    newRecentImport({ ...credentials, version: 'v1' }, null, 'sample', true),
  ).toThrow('RD_V2_REQUIRED'));

it('preserves previous sample ownership while simulating and creating a larger sample', () => {
  const old = newRecentImport(
    credentials,
    newRecentImport(credentials, null, 'sample', true),
    'sample',
    false,
  );
  old.selection!.limit = 25;
  old.preview!.owned = 93;
  const dry = newRecentImport(credentials, old, 'sample', true);
  expect(dry.selection!.limit).toBe(125);
  expect(dry.preview).toEqual(old.preview);
  expect(dry.selection!.selectedDeals).toEqual([]);
  const live = newRecentImport(credentials, dry, 'sample', false);
  expect(live.preview!.runId).toBe(old.preview!.runId);
  expect(live.preview!.owned).toBe(93);
});
it('preserves a previously simulated limit and restores an excluded sample before expansion', () => {
  const old = newRecentImport(
    credentials,
    newRecentImport(credentials, null, 'sample', true),
    'sample',
    false,
  );
  old.preview!.status = 'REMOVED';
  old.preview!.removed = 93;
  const dry = newRecentImport(credentials, old, 'sample', true);
  expect(dry.maintenance).toBeUndefined();
  const live = newRecentImport(credentials, dry, 'sample', false);
  expect(live.maintenance).toBe('restore');
  expect(live.preview!.status).toBe('AVAILABLE');
  expect(live.preview!.runId).toBe(old.preview!.runId);
  dry.selection!.limit = 25;
  expect(
    newRecentImport(credentials, dry, 'sample', false).selection!.limit,
  ).toBe(25);
});
