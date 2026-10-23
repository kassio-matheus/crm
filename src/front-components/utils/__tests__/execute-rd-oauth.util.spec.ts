import { expect, it, vi } from 'vitest';
const execute = vi.hoisted(() => vi.fn());
vi.mock('../execute-app-function.util', () => ({
  executeAppFunction: execute,
}));
import { executeRdOAuth } from '../execute-rd-oauth.util';
import { OAUTH_CONTROL } from 'src/constants/rd-identifiers';
it('uses an authenticated internal route without passing credentials in function payloads', async () => {
  execute.mockResolvedValue({
    callbackUrl: 'https://crm.test/s/rd-station/oauth/callback',
  });
  await executeRdOAuth('status');
  expect(execute).toHaveBeenCalledWith(OAUTH_CONTROL, { action: 'status' });
});
