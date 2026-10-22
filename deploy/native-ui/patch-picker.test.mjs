import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { patchPicker } from './patch-picker.mjs';
import { applyNativeUiPatch } from './apply.mjs';
const fixture =
  'const i=`view-picker-options-${o.id}`,v=w||o.visibility===ee.UNLISTED,x=p.find(g=>g.id===o.id);return v';
test('hides edit/delete for managed boards even for administrators; other view permissions remain intact', () => {
  const evaluate = new Function('o', 'w', 'ee', 'p', patchPicker(fixture));
  for (const permitted of [true, false])
    for (const visibility of ['WORKSPACE', 'UNLISTED'])
      assert.equal(
        evaluate(
          { id: 'p', type: 'KANBAN', icon: 'IconLock', visibility },
          permitted,
          { UNLISTED: 'UNLISTED' },
          [],
        ),
        false,
      );
  for (const type of ['TABLE', 'KANBAN']) {
    assert.equal(
      evaluate(
        { type, icon: 'IconLayoutKanban', visibility: 'WORKSPACE' },
        true,
        {},
        [],
      ),
      true,
    );
    assert.equal(
      evaluate(
        { type, icon: 'IconLayoutKanban', visibility: 'WORKSPACE' },
        false,
        {},
        [],
      ),
      false,
    );
    assert.equal(
      evaluate(
        { type, icon: 'IconLock', visibility: 'UNLISTED' },
        false,
        { UNLISTED: 'UNLISTED' },
        [],
      ),
      type !== 'KANBAN',
    );
  }
});
test('rejects missing, duplicated or already transformed gates', () => {
  assert.throws(() => patchPicker('different version'), /Unsupported/);
  assert.throws(() => patchPicker(fixture + fixture), /Unsupported/);
  assert.throws(() => patchPicker(patchPicker(fixture)), /Unsupported/);
});
test('refuses a different upstream bundle before modifying any file', () => {
  const root = mkdtempSync(join(tmpdir(), 'crm-ui-patch-'));
  try {
    mkdirSync(join(root, 'assets'));
    const file = join(root, 'assets/RecordIndexPage-D8zcMDY8.js');
    writeFileSync(file, fixture);
    assert.throws(() => applyNativeUiPatch(root), /checksum/);
    assert.equal(readFileSync(file, 'utf8'), fixture);
  } finally {
    rmSync(root, { recursive: true });
  }
});
