import { beforeEach, expect, it, vi } from 'vitest';
const mutation = vi.hoisted(() => vi.fn());
vi.mock('twenty-client-sdk/metadata', () => ({
  MetadataApiClient: class {
    mutation = mutation;
  },
}));
import { saveImportConnection } from '../save-import-connection.util';
import { importState } from 'src/__tests__/fixtures/import-state';
const credentials = {
  version: 'v2' as const,
  accountKey: 'acme',
  accessToken: 'STALE',
  refreshToken: 'STALE_REFRESH',
  clientId: 'client',
  clientSecret: 'SECRET',
};
beforeEach(() => {
  vi.clearAllMocks();
  mutation.mockResolvedValue({});
});
it('saves only in encrypted application configuration and clears stale manual tokens for automatic OAuth', async () => {
  await saveImportConnection(credentials, false, null);
  const value = JSON.parse(
    mutation.mock.calls[0][0].updateOneApplicationVariable.__args.value,
  );
  expect(value.accessToken).toBe('');
  expect(value.refreshToken).toBe('');
  expect(value.clientSecret).toBe('SECRET');
});
it('refuses tenant/version changes and writes during running work', async () => {
  await expect(
    saveImportConnection(
      { ...credentials, accountKey: 'other' },
      false,
      importState(),
    ),
  ).rejects.toThrow('mesma empresa');
  await expect(
    saveImportConnection(credentials, false, importState()),
  ).rejects.toThrow('Pause');
  expect(mutation).not.toHaveBeenCalled();
});
it('validates required fields and sanitizes remote errors', async () => {
  await expect(
    saveImportConnection({ ...credentials, clientSecret: '' }, false, null),
  ).rejects.toThrow('Client secret');
  mutation.mockRejectedValueOnce(new Error('SECRET in remote body'));
  await expect(saveImportConnection(credentials, false, null)).rejects.toThrow(
    'Não foi possível salvar',
  );
});
