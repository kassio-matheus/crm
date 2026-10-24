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
    selection: { scope: 'sample', limit: 25 },
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
