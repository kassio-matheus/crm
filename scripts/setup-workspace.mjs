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
    'page-layout-tabs',
    'navigation-menu-items',
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
  // Switching an existing PAGE_LAYOUT item to a new VIEW needs that view to exist first.
  rmSync(
    join(
      staging,
      'src/navigation-menu-items/main-page.navigation-menu-item.ts',
    ),
    { force: true },
  );
  mkdirSync(join(staging, 'src', 'front-components'), { recursive: true });
  for (const filename of ['main-page.tsx', 'rd-import-page.tsx']) {
    const source = readFileSync(
      join(root, 'src', 'front-components', filename),
      'utf8',
    );
    const constants = readFileSync(
      join(
        root,
        'src',
        'constants',
        filename === 'main-page.tsx'
          ? 'universal-identifiers.ts'
          : 'rd-identifiers.ts',
      ),
      'utf8',
    );
    const name =
      filename === 'main-page.tsx'
        ? 'MAIN_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER'
        : 'IMPORT_COMPONENT';
    const identifier = constants.match(
      new RegExp(`${name}\\s*=\\s*'([^']+)'`),
    )?.[1];
    if (!identifier || !source.includes('defineFrontComponent'))
      throw new Error('Missing stable component identifier.');
    writeFileSync(
      join(staging, 'src', 'front-components', filename),
      `import { defineFrontComponent } from 'twenty-sdk/define';\nexport default defineFrontComponent({ universalIdentifier: '${identifier}', name: '${filename === 'main-page.tsx' ? 'Negociações' : 'rd-import-page'}', component: () => null });\n`,
    );
  }
  execFileSync(
    'yarn',
    [
      'twenty',
      process.argv.includes('--plan-only') ? 'plan' : 'apply',
      '--no-delete',
      staging,
    ],
    {
      cwd: root,
      stdio: 'inherit',
    },
  );
  if (!process.argv.includes('--plan-only'))
    execFileSync('yarn', ['twenty', 'dev:generate-client'], {
      cwd: root,
      stdio: 'inherit',
    });
  if (
    process.argv.includes('--model-only') ||
    process.argv.includes('--plan-only')
  )
    process.exitCode = 0;
  else
    execFileSync('yarn', ['twenty', 'apply', '--no-delete'], {
      cwd: root,
      stdio: 'inherit',
    });
} finally {
  rmSync(staging, { recursive: true, force: true });
}
