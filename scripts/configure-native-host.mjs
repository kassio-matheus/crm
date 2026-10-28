import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, chmodSync } from 'node:fs';
import { resolve, join } from 'node:path';
const container = process.argv[2] ?? 'twenty-app-dev';
if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(container))
  throw new Error('Invalid local container name.');
const root = resolve(import.meta.dirname, '..');
const backup = join(root, '.twenty/backups/native-ui', container, 'front');
const docker = (...args) => execFileSync('docker', args, { stdio: 'inherit' });
if (!existsSync(backup)) {
  mkdirSync(backup, { recursive: true, mode: 0o700 });
  docker('cp', `${container}:/app/packages/twenty-server/dist/front/.`, backup);
  chmodSync(backup, 0o700);
}
docker('exec', container, 'mkdir', '-p', '/tmp/crm-native-ui');
for (const name of [
  'apply.mjs',
  'patch-picker.mjs',
  'patch-sales.mjs',
  'sales-bulk-policy.mjs',
  'sales-bulk-runtime.mjs',
  'sales-board-runtime.mjs',
  'sales-filters-runtime.mjs',
])
  docker(
    'cp',
    join(root, 'deploy/native-ui', name),
    `${container}:/tmp/crm-native-ui/${name}`,
  );
docker('exec', container, 'node', '/tmp/crm-native-ui/apply.mjs');
// Twenty caches index.html at startup; reload it after asset URLs have changed.
docker('restart', container);
console.log('Local Twenty picker configured. Refresh the open Twenty page.');
