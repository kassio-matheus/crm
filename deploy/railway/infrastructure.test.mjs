import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRailwayContext } from 'railway/iac';
import infrastructure from '../../.railway/railway.ts';
import { chooseDomain } from '../../scripts/deploy-railway.mjs';

const definition = await infrastructure(
  createRailwayContext({ environment: 'production' }),
);
const byName = (name) =>
  definition.resources.find((resource) => resource.name === name);
test('declares the whole stack including persistent private databases and a native bucket', () => {
  assert.equal(definition.resources.length, 8);
  assert.equal(byName('Storage').type, 'bucket');
  assert.equal(byName('Postgres Data').config.sizeMB, 4096);
  assert.equal(byName('Redis Data').config.sizeMB, 1024);
  for (const name of ['Postgres', 'Redis']) {
    const node = byName(name);
    assert.equal(node.type, 'service');
    assert.equal(Object.keys(node.volumeAttachments).length, 1);
    assert.equal(node.networking, undefined);
    assert.equal(node.deploy.numReplicas, 1);
    assert.ok(node.deploy.requiredMountPath);
  }
});
test('secrets are external shared references and cannot be rotated by IaC evaluation', () => {
  const server = byName('Twenty');
  const worker = byName('Twenty Worker');
  for (const [service, key, sharedName] of [
    ['Postgres', 'POSTGRES_PASSWORD', 'CRM_POSTGRES_PASSWORD'],
    ['Redis', 'REDIS_PASSWORD', 'CRM_REDIS_PASSWORD'],
    ['Twenty', 'ENCRYPTION_KEY', 'CRM_ENCRYPTION_KEY'],
    ['Twenty', 'APP_SECRET', 'CRM_APP_SECRET'],
    ['Database Backup', 'BACKUP_ENCRYPTION_KEY', 'CRM_BACKUP_ENCRYPTION_KEY'],
  ]) {
    assert.deepEqual(byName(service).variables[key], {
      type: 'sharedReference',
      name: sharedName,
    });
  }
  for (const key of Object.keys(server.variables)) {
    if (
      [
        'TWENTY_PROCESS',
        'DISABLE_DB_MIGRATIONS',
        'DISABLE_CRON_JOBS_REGISTRATION',
      ].includes(key)
    )
      continue;
    assert.deepEqual(worker.variables[key], {
      type: 'reference',
      resource: server.address,
      output: key,
    });
  }
  assert.deepEqual(server.variables.STORAGE_S3_NAME, {
    type: 'reference',
    resource: byName('Storage').address,
    output: 'BUCKET',
  });
});
test('only the server runs migrations and the worker keeps preflight plus readiness', () => {
  const server = byName('Twenty');
  const worker = byName('Twenty Worker');
  assert.equal(server.deploy.healthcheckPath, '/healthz');
  assert.equal(server.variables.DISABLE_DB_MIGRATIONS.value, 'false');
  assert.equal(worker.variables.DISABLE_DB_MIGRATIONS.value, 'true');
  assert.equal(worker.variables.DISABLE_CRON_JOBS_REGISTRATION.value, 'true');
  assert.equal(worker.variables.TWENTY_PROCESS.value, 'worker');
  assert.equal(
    worker.deploy.startCommand,
    '/app/railway-entrypoint.sh yarn worker:prod',
  );
  assert.deepEqual(server.source, worker.source);
  assert.deepEqual(server.build, worker.build);
  assert.equal(worker.networking, undefined);
});
test('generated public domain selection cannot silently use a wrong target port', () => {
  assert.equal(chooseDomain({ domains: [] }), undefined);
  assert.equal(
    chooseDomain({
      domains: [
        { type: 'service', targetPort: 3000, domain: 'crm.up.railway.app' },
      ],
    }),
    'crm.up.railway.app',
  );
  assert.throws(
    () =>
      chooseDomain({
        domains: [
          { type: 'service', targetPort: 80, domain: 'crm.up.railway.app' },
        ],
      }),
    /port 3000/,
  );
});

test('daily encrypted database backup exits between runs and stays private', () => {
  const backup = byName('Database Backup');
  assert.equal(backup.deploy.cronSchedule, '0 6 * * *');
  assert.equal(backup.deploy.restartPolicyType, 'NEVER');
  assert.equal(backup.networking, undefined);
  assert.equal(backup.build.dockerfilePath, 'deploy/railway/backup/Dockerfile');
  assert.equal(byName('Twenty').variables.TRUST_PROXY.value, '1');
});
