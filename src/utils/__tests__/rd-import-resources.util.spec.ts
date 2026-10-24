import { expect, it } from 'vitest';
import { rdImportResources } from '../rd-import-resources.util';
it('preserves every persisted resource checkpoint index in both versions', () => {
  expect(rdImportResources('v2')).toEqual([
    'pipelines',
    'users',
    'teams',
    'organizations',
    'contacts',
    'campaigns',
    'sources',
    'products',
    'lost_reasons',
    'custom_fields',
    'segments',
    'deals',
    'tasks',
    'meetings',
    'users/meeting_availability',
  ]);
  expect(rdImportResources('v1')).toEqual([
    'deal_pipelines',
    'users',
    'teams',
    'organizations',
    'contacts',
    'products',
    'campaigns',
    'deal_sources',
    'deal_lost_reasons',
    'custom_fields',
    'deals',
    'tasks?done=false',
    'tasks?done=true',
  ]);
});
