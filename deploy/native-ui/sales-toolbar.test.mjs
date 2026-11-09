import assert from 'node:assert/strict';
import test from 'node:test';
import { contactPhoneFilter } from './contact-phone-search.mjs';
import { salesStatusCriteria } from './sales-bulk-policy.mjs';
import {
  replaceSalesQuickFilters,
  salesQuickScope,
} from './sales-toolbar-policy.mjs';

test('telephone lookup handles Brazilian dialing prefixes and formatted storage', () => {
  const search = contactPhoneFilter('+55 (82) 99912-3456');
  const patterns = search.or.map(
    ({ phones }) => Object.values(phones)[0].ilike,
  );
  assert.ok(patterns.includes('%82999123456%'));
  assert.ok(patterns.includes('%(82) 99912-3456%'));
  assert.ok(search.or.some(({ phones }) => phones.additionalPhones));
  assert.equal(contactPhoneFilter('Ana 1234'), undefined);
  assert.equal(contactPhoneFilter('12'), undefined);
});

test('changing status preserves an unrelated advanced OR and owner selection', () => {
  const fields = ['dealStatus', 'stage', 'owner', 'name'].map((name) => ({
    id: name,
    name,
  }));
  const old = salesStatusCriteria('ONGOING').groups.map((group, index) => ({
    id: `status-${index}`,
    logicalOperator: group.operator,
    parentRecordFilterGroupId: 'root',
    filters: group.filters.map(({ field, op, value }, position) => ({
      id: `status-${index}-${position}`,
      fieldMetadataId: field,
      operand: op,
      value,
      recordFilterGroupId: `status-${index}`,
    })),
  }));
  const groups = [
    { id: 'root', logicalOperator: 'AND' },
    {
      id: 'advanced',
      logicalOperator: 'OR',
      parentRecordFilterGroupId: 'root',
    },
    ...old.map(({ filters: _filters, ...group }) => group),
  ];
  const filters = [
    ...old.flatMap((group) => group.filters),
    {
      id: 'owner',
      fieldMetadataId: 'owner',
      operand: 'IS',
      value: '["a","b"]',
    },
    {
      id: 'advanced-status',
      fieldMetadataId: 'dealStatus',
      operand: 'IS',
      value: '["PAUSED"]',
      recordFilterGroupId: 'advanced',
    },
    {
      id: 'advanced-name',
      fieldMetadataId: 'name',
      operand: 'CONTAINS',
      value: 'QA',
      recordFilterGroupId: 'advanced',
    },
  ];
  const scope = salesQuickScope(filters, groups, fields);
  assert.equal(scope.status, 'ONGOING');
  const result = replaceSalesQuickFilters({
    filters,
    groups,
    removeFilters: scope.statusFilters,
    removeGroups: scope.statusGroupIds,
    added: { recordFilters: [], recordFilterGroups: [] },
    newId: () => 'new',
  });
  assert.deepEqual(
    result.filters.map(({ id }) => id),
    ['owner', 'advanced-status', 'advanced-name'],
  );
  assert.deepEqual(
    result.groups.map(({ id }) => id),
    ['root', 'advanced'],
  );
});
