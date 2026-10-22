import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir, homedir } from 'node:os';
import { join, resolve } from 'node:path';

// A fresh SDK has no workspace schema. Sync only metadata first, generate it, then sync the full app.
const root = resolve(import.meta.dirname, '..');
const staging = mkdtempSync(join(tmpdir(), 'twenty-rd-model-'));
try {
  if (
    process.env.NODE_ENV === 'test' &&
    process.env.TWENTY_API_URL &&
    process.env.TWENTY_API_KEY
  ) {
    const directory = join(homedir(), '.twenty');
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, 'config.test.json'),
      JSON.stringify({
        version: 1,
        remotes: {
          local: {
            apiUrl: process.env.TWENTY_API_URL,
            apiKey: process.env.TWENTY_API_KEY,
          },
        },
        defaultRemote: 'local',
      }),
      { mode: 0o600 },
    );
  }
  for (const filename of [
    'package.json',
    'tsconfig.json',
    'tsconfig.spec.json',
    '.yarnrc.yml',
  ])
    cpSync(join(root, filename), join(staging, filename));
  symlinkSync(join(root, 'node_modules'), join(staging, 'node_modules'), 'dir');
  for (const folder of [
    'constants',
    'fields',
    'objects',
    'views',
    'page-layouts',
    'roles',
    'agents',
    'skills',
  ]) {
    const source = join(root, 'src', folder);
    if (existsSync(source))
      cpSync(source, join(staging, 'src', folder), { recursive: true });
  }
  for (const filename of ['application-config.ts', 'default-role.ts'])
    cpSync(join(root, 'src', filename), join(staging, 'src', filename));
  cpSync(join(root, 'public'), join(staging, 'public'), { recursive: true });
  // Metadata bootstrap must not replace live front components with temporary stubs.
  // Omit UI that depends on them until the generated workspace SDK is available.
  for (const filename of [
    'main-page.page-layout.ts',
    'rd-import.page-layout.ts',
  ])
    rmSync(join(staging, 'src', 'page-layouts', filename), { force: true });
  const yarnLauncher =
    process.env.npm_execpath ||
    execFileSync('which', ['yarn'], { encoding: 'utf8' }).trim();
  const shellLauncher = /^#!.*(?:sh|bash)(?:\s|$)/.test(
    readFileSync(yarnLauncher, 'utf8').split('\n')[0],
  );
  const runYarn = (args) =>
    execFileSync(
      shellLauncher ? yarnLauncher : process.execPath,
      shellLauncher ? args : [yarnLauncher, ...args],
      { cwd: root, stdio: 'inherit' },
    );
  runYarn([
    'twenty',
    process.argv.includes('--plan-only') ? 'plan' : 'apply',
    '--no-delete',
    staging,
  ]);
  if (!process.argv.includes('--plan-only'))
    runYarn(['twenty', 'dev:generate-client']);
  if (
    process.argv.includes('--model-only') ||
    process.argv.includes('--plan-only')
  )
    process.exitCode = 0;
  else runYarn(['twenty', 'apply', '--no-delete']);
} finally {
  rmSync(staging, { recursive: true, force: true });
}
