import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  patchSalesBoard,
  patchSalesCommands,
  patchSalesIndex,
  patchSalesPicker,
} from './patch-sales.mjs';
test('all host adaptations reject unsupported or repeated anchors', () => {
  for (const patch of [
    patchSalesBoard,
    patchSalesCommands,
    patchSalesIndex,
    patchSalesPicker,
  ])
    assert.throws(() => patch('unrecognized release'), /Unsupported/);
  const picker = 'objectNameSingular:t,limit:10,allowRequestsToTwentyIcons:a}';
  assert.throws(() => patchSalesPicker(picker + picker), /Unsupported/);
});
test('stage picker adds a pipeline constraint while preserving native search, selected IDs and icon policy', () => {
  const source =
    'Ii({searchFilterText:l,selectedIds:C,objectNameSingular:t,limit:10,allowRequestsToTwentyIcons:a})';
  const result = patchSalesPicker(source);
  assert.match(result, /filter:crmUseStagePickerFilter\(t,c\)/);
  assert.match(result, /searchFilterText:l,selectedIds:C/);
  assert.throws(() => patchSalesPicker(result), /Unsupported/);
});
test(
  'actual pinned native bundles support all adaptations and reject applying them twice',
  { skip: !process.env.TWENTY_FRONT_FIXTURE },
  () => {
    const root = process.env.TWENTY_FRONT_FIXTURE;
    for (const [name, patch] of [
      ['index-CgifpLnX.js', patchSalesIndex],
      ['useCombinedFindManyRecords-BsM_Luc_.js', patchSalesBoard],
      ['CommandMenuContextProvider-D98N3AUR.js', patchSalesCommands],
      ['RecordIndexPage-D8zcMDY8.js', patchSalesPicker],
    ]) {
      const file = join(root, 'assets', name);
      assert.ok(existsSync(file));
      const out = patch(readFileSync(file, 'utf8'));
      assert.ok(out.length > 0);
      assert.throws(() => patch(out), /Unsupported/);
    }
  },
);
