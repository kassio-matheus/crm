import { beforeEach, describe, expect, it, vi } from 'vitest';
const post = vi.hoisted(() => vi.fn());
vi.mock('twenty-client-sdk/rest', () => ({
  RestApiClient: class {
    post = post;
  },
}));
import { executeAppFunction } from '../execute-app-function.util';
import { IMPORT_CONTROL } from 'src/constants/rd-identifiers';
beforeEach(() => vi.clearAllMocks());
describe('executeAppFunction', () => {
  it('uses an authenticated app route without reading the function-management API', async () => {
    post.mockResolvedValue({ result: 1 });
    expect(
      await executeAppFunction(IMPORT_CONTROL, { action: 'status' }),
    ).toEqual({ result: 1 });
    expect(post).toHaveBeenCalledWith('/s/rd-import', { action: 'status' });
  });
  it('rejects function errors without exposing payload logs', async () => {
    post.mockRejectedValue(new Error('token=SECRET'));
    await expect(executeAppFunction(IMPORT_CONTROL, {})).rejects.toThrow(
      'Não foi possível',
    );
  });
  it('does not execute an unknown action', async () => {
    await expect(executeAppFunction('x', {})).rejects.toThrow('desconhecida');
    expect(post).not.toHaveBeenCalled();
  });
});
