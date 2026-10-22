import { describe, expect, it, vi } from 'vitest';
const execute = vi.hoisted(() => vi.fn().mockResolvedValue(null));
vi.mock('src/front-components/utils/execute-app-function.util', () => ({
  executeAppFunction: execute,
}));
import { executeImport } from '../execute-import.util';
import { IMPORT_CONTROL } from 'src/constants/rd-identifiers';
describe('executeImport', () => {
  it('only sends the action, never credentials', async () => {
    expect(await executeImport('resume')).toBeNull();
    expect(execute).toHaveBeenCalledWith(IMPORT_CONTROL, { action: 'resume' });
  });
});
