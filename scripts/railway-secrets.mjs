import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const sharedSecretNames = [
  'CRM_POSTGRES_PASSWORD',
  'CRM_REDIS_PASSWORD',
  'CRM_ENCRYPTION_KEY',
  'CRM_APP_SECRET',
  'CRM_BACKUP_ENCRYPTION_KEY',
];
export const serverDefaults = {
  EMAIL_DRIVER: 'LOGGER',
  EMAIL_FROM_ADDRESS: 'noreply@yourdomain.com',
  EMAIL_FROM_NAME: 'CRM',
  EMAIL_SMTP_HOST: '',
  EMAIL_SMTP_PORT: '587',
  EMAIL_SMTP_USER: '',
  EMAIL_SMTP_PASSWORD: '',
  EMAIL_SMTP_NO_TLS: 'false',
  AI_PROVIDERS: '{}',
};
const cli = fileURLToPath(
  new URL('../node_modules/.bin/railway', import.meta.url),
);
export const railwayStatus = () =>
  JSON.parse(execFileSync(cli, ['status', '--json'], { encoding: 'utf8' }));
export function requestRailway(query, variables) {
  try {
    const response = JSON.parse(
      execFileSync(cli, ['api', query, '--variables', '@-', '--compact'], {
        input: JSON.stringify(variables),
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }),
    );
    if (response.errors) throw new Error('Railway rejected the request');
    return response.data;
  } catch {
    // API inputs and error bodies can contain credentials; never include them.
    throw new Error(
      'Railway configuration request failed. Check authentication and the selected project.',
    );
  }
}
export function resolveRailwayTarget(
  environment = process.env.CRM_RAILWAY_ENVIRONMENT ?? 'production',
) {
  const status = railwayStatus();
  const matches = status.environments.edges
    .map(({ node }) => node)
    .filter(
      (node) => !node.deletedAt && [node.name, node.id].includes(environment),
    );
  if (matches.length !== 1)
    throw new Error(
      'Set CRM_RAILWAY_ENVIRONMENT to the exact target environment name or ID.',
    );
  return {
    projectId: status.id,
    environmentId: matches[0].id,
    projectName: status.name,
    environmentName: matches[0].name,
  };
}
const readVariables =
  'query($projectId:String!,$environmentId:String!,$serviceId:String){variables(projectId:$projectId,environmentId:$environmentId,serviceId:$serviceId)}';
const upsertVariable =
  'mutation($input:VariableUpsertInput!){variableUpsert(input:$input)}';

export function initializeSharedSecrets(
  target,
  {
    request = requestRailway,
    generate = () => randomBytes(32).toString('hex'),
  } = {},
) {
  const scope = {
    projectId: target.projectId,
    environmentId: target.environmentId,
  };
  const current = request(readVariables, scope).variables;
  for (const name of sharedSecretNames)
    if (current[name] !== undefined && !/^[a-f0-9]{64}$/.test(current[name]))
      throw new Error(
        `Invalid existing ${name}. Restore or rotate it deliberately; automatic replacement is disabled.`,
      );
  const existing = sharedSecretNames
    .filter((name) => current[name] !== undefined)
    .map((name) => current[name]);
  if (new Set(existing).size !== existing.length)
    throw new Error('Existing application secrets must be independent.');
  const generated = new Set(Object.values(current));
  let created = 0;
  for (const name of sharedSecretNames) {
    if (current[name] !== undefined) continue;
    const value = generate();
    if (!/^[a-f0-9]{64}$/.test(value) || generated.has(value))
      throw new Error('Secret generation failed validation.');
    generated.add(value);
    request(upsertVariable, {
      input: { ...scope, name, value, skipDeploys: true },
    });
    created++;
  }
  return { created, preserved: sharedSecretNames.length - created };
}

export function initializeServerDefaults(
  target,
  { request = requestRailway, getStatus = railwayStatus } = {},
) {
  const status = getStatus();
  const service = status.services.edges
    .map(({ node }) => node)
    .find((node) => node.name === 'Twenty');
  if (!service)
    throw new Error('Twenty service must exist before initializing defaults.');
  const scope = {
    projectId: target.projectId,
    environmentId: target.environmentId,
    serviceId: service.id,
  };
  const current = request(readVariables, scope).variables;
  for (const [name, value] of Object.entries(serverDefaults))
    if (current[name] === undefined)
      request(upsertVariable, {
        input: { ...scope, name, value, skipDeploys: true },
      });
}
