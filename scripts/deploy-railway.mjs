import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import {
  resolveRailwayTarget,
  initializeSharedSecrets,
  initializeServerDefaults,
} from './railway-secrets.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = fileURLToPath(
  new URL('../node_modules/.bin/railway', import.meta.url),
);
export function chooseDomain(result) {
  const domains = result.domains ?? [];
  const generated = domains.filter((item) => item.type === 'service');
  if (generated.length > 1)
    throw new Error(
      'Multiple Railway domains found. Review the Twenty domain configuration.',
    );
  if (generated[0] && generated[0].targetPort !== 3000)
    throw new Error('The existing Twenty domain must target port 3000.');
  return generated[0]?.domain;
}
function run(args, json = false) {
  const result = spawnSync(cli, args, {
    cwd: root,
    stdio: json ? ['inherit', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `Railway ${args[0]} failed. Resolve the CLI error before continuing.`,
    );
  return json ? JSON.parse(result.stdout) : undefined;
}
export async function deploy() {
  if (process.argv.length > 2)
    throw new Error(
      'This command accepts no flags. Use railway:plan to preview the linked environment.',
    );
  // Native CLI prints the project, environment and plan and asks for confirmation.
  // Deliberately never pass --yes, --show-values, or --confirm-destructive here.
  run(['whoami', '--json'], true);
  const target = resolveRailwayTarget();
  console.log(`Target: ${target.projectName} / ${target.environmentName}`);
  const secrets = initializeSharedSecrets(target);
  console.log(
    `Secrets: ${secrets.created} initialized, ${secrets.preserved} preserved.`,
  );
  const environmentArgs = ['--environment', target.environmentId];
  run(['config', 'apply', '--file', '.railway/railway.ts', ...environmentArgs]);
  initializeServerDefaults(target);
  let domain = chooseDomain(
    run(
      ['domain', 'list', '--service', 'Twenty', '--json', ...environmentArgs],
      true,
    ),
  );
  if (!domain) {
    run(
      [
        'domain',
        '--service',
        'Twenty',
        '--port',
        '3000',
        '--json',
        ...environmentArgs,
      ],
      true,
    );
    domain = chooseDomain(
      run(
        ['domain', 'list', '--service', 'Twenty', '--json', ...environmentArgs],
        true,
      ),
    );
  }
  if (!domain)
    throw new Error('Railway has not assigned the Twenty public domain.');
  // Railway-generated domains are outside IaC reconciliation. Resolve SERVER_URL
  // before the final server/worker deployments, including a failed first boot.
  for (const service of ['Twenty', 'Twenty Worker'])
    run([
      'redeploy',
      '--service',
      service,
      '--from-source',
      '--yes',
      ...environmentArgs,
    ]);
  console.log(
    `Waiting for https://${domain}/healthz (up to 30 minutes including builds)...`,
  );
  const deadline = Date.now() + 1_800_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`https://${domain}/healthz`, {
        signal: AbortSignal.timeout(5_000),
      });
      await response.body?.cancel();
      if (response.ok) {
        console.log(`Twenty is ready: https://${domain}`);
        console.log(
          'Create the first administrator, then follow docs/RAILWAY.md to install the CRM app and configure email.',
        );
        return;
      }
    } catch {
      /* Public routing/builds may still be starting. */
    }
    await delay(15_000);
    console.log(
      'Still waiting for the Twenty health check; build and worker logs are available in Railway.',
    );
  }
  throw new Error(
    'Health check deadline reached. Services were preserved. Check Railway logs and rerun after correcting the cause.',
  );
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  deploy().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
