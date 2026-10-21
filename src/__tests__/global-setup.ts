import { appDevOnce } from 'twenty-sdk/cli';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export async function setup() {
  const apiUrl = process.env.TWENTY_API_URL;
  const apiKey = process.env.TWENTY_API_KEY;
  if (!apiUrl || !apiKey)
    throw new Error(
      'Integration tests need an isolated Twenty URL and API key.',
    );
  const target = new URL(apiUrl);
  if (
    !['localhost', '127.0.0.1'].includes(target.hostname) ||
    target.port !== '2021'
  )
    throw new Error(
      'Integration tests are restricted to localhost:2021. No app uninstall is performed.',
    );
  if (!(await fetch(`${apiUrl}/healthz`)).ok)
    throw new Error('The isolated Twenty test server is unavailable.');
  const dir = path.join(os.homedir(), '.twenty');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'config.test.json'),
    JSON.stringify({
      version: 1,
      remotes: { local: { apiUrl, apiKey, twentyCLIAccessToken: apiKey } },
      defaultRemote: 'local',
    }),
    { mode: 0o600 },
  );
  // The SDK uses config.test.json when NODE_ENV=test. Disable inference of deleted entities.
  const result = await appDevOnce({
    appPath: process.cwd(),
    apply: true,
    inferDeletionFromMissingEntities: false,
    confirmApply: async () => true,
  });
  if (!result.success)
    throw new Error(`Test instance sync failed: ${result.error?.message}`);
}
