import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { phaseScope } from './sales-bulk-policy.mjs';

test('a phase panel never broadens native selection to the whole workspace, even if its in-memory scope is later lost', () => {
  const source = readFileSync(
    new URL('./sales-bulk-runtime.mjs', import.meta.url),
    'utf8',
  ).replace('export const createSalesBulkUi', 'const createSalesBulkUi');
  const factory = runInNewContext(source + ';createSalesBulkUi', {
    phaseScope,
    crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000001' },
  });
  const writes = new Map(),
    atomFamily = ({ instanceId }) => instanceId;
  const ui = factory({
    React: { createElement: () => null },
    objectId: { atomFamily: ({ instanceId }) => 'object:' + instanceId },
    rule: { atomFamily },
  });
  let page;
  ui.openPhase(
    (value) => {
      page = value;
    },
    { salesPipelineId: { eq: 'pipeline' } },
    '00000000-0000-4000-8000-000000000002',
    { set: (key, value) => writes.set(key, value) },
    'object',
  );
  assert.ok(ui.hasScope(page.pageId));
  assert.equal(writes.get('object:' + page.pageId), 'object');
  assert.equal(
    JSON.stringify(writes.get(page.pageId)),
    JSON.stringify({ mode: 'selection', selectedRecordIds: [] }),
  );
  assert.equal(page.page, 'update-records');
});
