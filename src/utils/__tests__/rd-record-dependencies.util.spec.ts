import { expect, it } from 'vitest';
import { rdRecordDependencies } from '../rd-record-dependencies.util';
it('finds organization and primary contact dependencies in both API shapes', () => {
  expect(
    rdRecordDependencies('deals', {
      organization: { _id: 'org' },
      contacts: [{ id: 'person' }],
    }),
  ).toEqual([
    { kind: 'organizations', id: 'org' },
    { kind: 'contacts', id: 'person' },
  ]);
  expect(rdRecordDependencies('contacts', { organization_id: 'org' })).toEqual([
    { kind: 'organizations', id: 'org' },
  ]);
});
it('finds a task deal without treating unrelated IDs as dependencies', () => {
  expect(rdRecordDependencies('tasks', { deal_id: 'deal' })).toEqual([
    { kind: 'deals', id: 'deal' },
  ]);
  expect(rdRecordDependencies('users', { organization_id: 'org' })).toEqual([]);
});
it('rejects reference path injection before any request', () =>
  expect(() =>
    rdRecordDependencies('deals', { organization_id: '../oauth2/token' }),
  ).toThrow('Invalid source reference'));
