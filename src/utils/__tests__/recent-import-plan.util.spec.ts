import { expect, it } from 'vitest';
import { recentImportPlan } from '../recent-import-plan.util';
it('limits sample discovery to catalogs and recent deals', () => {
  expect(recentImportPlan(true)).toEqual([
    'pipelines',
    'users',
    'teams',
    'deals',
  ]);
});
it('prioritizes deals before unrelated older companies while retaining every v2 resource', () => {
  const plan = recentImportPlan(false);
  expect(plan.indexOf('deals')).toBeLessThan(plan.indexOf('organizations'));
  expect(plan.indexOf('deals')).toBeLessThan(plan.indexOf('contacts'));
  expect(new Set(plan).size).toBe(plan.length);
  expect(plan).toContain('users/meeting_availability');
});
