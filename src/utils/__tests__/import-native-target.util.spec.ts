import { expect, it } from 'vitest';
import { importNativeTarget } from '../import-native-target.util';
it('only exposes soft-delete and restore operations for supported import objects', () => {
  expect(importNativeTarget('companies')).toMatchObject({
    remove: 'deleteCompany',
    restore: 'restoreCompany',
    keyField: 'rdSourceKey',
  });
  expect(importNativeTarget('salesStages').keyField).toBe('sourceKey');
  expect(importNativeTarget('taskTargets').keyField).toBeNull();
  expect(() => importNativeTarget('workspaceMembers')).toThrow(
    'RD_INVALID_PREVIEW_TARGET',
  );
  expect(() => importNativeTarget('rdSourceRecords')).toThrow(
    'RD_INVALID_PREVIEW_TARGET',
  );
});
