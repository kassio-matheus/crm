import { expect, it } from 'vitest';
import { parseOwnerReconcileRecords } from '../parse-owner-reconcile-records.util';
import { sourceId } from '../source-id.util';
const row = { id: sourceId('fixture'), kind: 'deals' };
it('accepts bounded bulk requests and removes exact duplicate identities', () => {
  expect(parseOwnerReconcileRecords({ records: [row, row] })).toEqual([row]);
});
it.each([
  null,
  {},
  { records: [] },
  { records: [{ id: 'bad', kind: 'deals' }] },
  { records: [{ ...row, kind: 'people' }] },
  { records: Array(51).fill(row) },
  { records: [null] },
])('rejects malformed or unbounded requests', (payload) => {
  expect(() => parseOwnerReconcileRecords(payload)).toThrow(
    'RD_OWNER_RECONCILE_INPUT',
  );
});
