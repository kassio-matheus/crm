import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { waitUntilReady } from '../deploy/railway/wait-for-services.mjs';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const prefix = `crm-railway-smoke-${randomBytes(4).toString('hex')}`;
const dockerArgs = process.env.CRM_DOCKER_CONFIG
  ? ['--config', process.env.CRM_DOCKER_CONFIG]
  : [];
const docker = async (...args) =>
  (
    await exec('docker', [...dockerArgs, ...args], {
      cwd: root,
      maxBuffer: 32 * 1024 * 1024,
    })
  ).stdout;
const directory = await mkdtemp(join(tmpdir(), `${prefix}-`));
const containers = [];
const volumes = [`${prefix}-pg`, `${prefix}-redis`];
const secret = () => randomBytes(32).toString('hex');
const pgPassword = secret();
const redisPassword = secret();
const redactedValues = [pgPassword, redisPassword];
const writeEnv = async (name, values) => {
  for (const [key, value] of Object.entries(values))
    if (/KEY|SECRET|PASSWORD/.test(key) && value) redactedValues.push(value);
  const path = join(directory, name);
  await writeFile(
    path,
    Object.entries(values)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n') + '\n',
    { mode: 0o600 },
  );
  return path;
};
const start = async (name, args) => {
  containers.push(name);
  return docker('run', '-d', '--name', name, '--network', prefix, ...args);
};
try {
  console.log('Building the pinned Twenty and Redis production images...');
  await docker(
    'build',
    '-f',
    'deploy/railway/Dockerfile',
    '-t',
    'crm-railway:complete-qa',
    '.',
  );
  await docker(
    'build',
    '-f',
    'deploy/railway/redis/Dockerfile',
    '-t',
    'crm-redis:railway-qa',
    '.',
  );
  await docker('network', 'create', prefix);
  for (const volume of volumes) await docker('volume', 'create', volume);
  const pgEnv = await writeEnv('pg.env', {
    POSTGRES_DB: 'twenty',
    POSTGRES_USER: 'twenty',
    POSTGRES_PASSWORD: pgPassword,
    PGDATA: '/var/lib/postgresql/data/pgdata',
  });
  const redisEnv = await writeEnv('redis.env', {
    REDIS_PASSWORD: redisPassword,
  });
  const shared = {
    NODE_ENV: 'production',
    NODE_PORT: '3000',
    PORT: '3000',
    SERVER_URL: 'https://crm-smoke.invalid',
    PG_DATABASE_URL: `postgresql://twenty:${pgPassword}@${prefix}-pg:5432/twenty`,
    REDIS_URL: `redis://default:${redisPassword}@${prefix}-redis:6379`,
    ENCRYPTION_KEY: secret(),
    APP_SECRET: secret(),
    STORAGE_TYPE: 's3',
    STORAGE_S3_ENDPOINT: 'https://storage-smoke.invalid',
    STORAGE_S3_NAME: 'smoke-bucket',
    STORAGE_S3_REGION: 'auto',
    STORAGE_S3_ACCESS_KEY_ID: secret(),
    STORAGE_S3_SECRET_ACCESS_KEY: secret(),
    STORAGE_S3_FORCE_PATH_STYLE: 'false',
    STORAGE_S3_PRESIGNED_URL_ENABLED: 'false',
    SIGN_IN_PREFILLED: 'false',
    IS_MULTIWORKSPACE_ENABLED: 'false',
    IS_CONFIG_VARIABLES_IN_DB_ENABLED: 'false',
    IS_BILLING_ENABLED: 'false',
    CODE_INTERPRETER_TYPE: 'DISABLED',
    LOGIC_FUNCTION_TYPE: 'LOCAL',
    TRUSTED_LOCAL_FUNCTIONS: 'true',
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
  const serverEnv = await writeEnv('server.env', {
    ...shared,
    TWENTY_PROCESS: 'server',
    DISABLE_DB_MIGRATIONS: 'false',
    DISABLE_CRON_JOBS_REGISTRATION: 'false',
  });
  const workerEnv = await writeEnv('worker.env', {
    ...shared,
    TWENTY_PROCESS: 'worker',
    TWENTY_INTERNAL_URL: `http://${prefix}-server:3000`,
    DISABLE_DB_MIGRATIONS: 'true',
    DISABLE_CRON_JOBS_REGISTRATION: 'true',
  });
  // Start the worker first to exercise real dependency/migration ordering.
  await start(`${prefix}-worker`, [
    '--env-file',
    workerEnv,
    'crm-railway:complete-qa',
    'yarn',
    'worker:prod',
  ]);
  await start(`${prefix}-pg`, [
    '--env-file',
    pgEnv,
    '-v',
    `${volumes[0]}:/var/lib/postgresql/data`,
    'postgres:16-alpine@sha256:f4610795587492cd4fb887c2dc3de301b813278bb6f616992061141b5f15ac36',
  ]);
  await start(`${prefix}-redis`, [
    '--env-file',
    redisEnv,
    '-v',
    `${volumes[1]}:/data`,
    'crm-redis:railway-qa',
  ]);
  await start(`${prefix}-server`, [
    '--env-file',
    serverEnv,
    'crm-railway:complete-qa',
  ]);
  console.log(
    'Waiting for a fresh database migration and the server health check...',
  );
  await waitUntilReady(
    async () => {
      const status = await docker(
        'exec',
        `${prefix}-server`,
        'node',
        '-e',
        "fetch('http://localhost:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))",
      );
      return status;
    },
    { label: 'fresh Twenty server', timeoutMs: 600_000, intervalMs: 5_000 },
  );
  await waitUntilReady(
    async () => {
      const processes = await docker(
        'top',
        `${prefix}-worker`,
        '-eo',
        'pid,args',
      );
      if (!processes.includes('node dist/queue-worker/queue-worker'))
        throw new Error('Worker is still waiting');
      const logs = await docker('logs', `${prefix}-worker`);
      if (!logs.includes('Twenty server and database migrations is ready.'))
        throw new Error('Readiness not confirmed');
    },
    {
      label: 'worker after server migrations',
      timeoutMs: 120_000,
      intervalMs: 2_000,
    },
  );
  await docker(
    'exec',
    `${prefix}-server`,
    'node',
    '-e',
    `
    const assert = require('node:assert/strict');
    const { FileStorageDriverFactory } = require('./dist/engine/core-modules/file-storage/file-storage-driver.factory');
    const { StorageDriverType } = require('./dist/engine/core-modules/file-storage/interfaces/file-storage.interface');
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
    const factory = new FileStorageDriverFactory({get: key => key === 'STORAGE_TYPE' ? StorageDriverType.S_3 : process.env[key]}, {});
    (async () => {
      const client = factory.createDriver().delegate.client;
      assert.equal(client.config.forcePathStyle, false);
      const url = new URL(await getSignedUrl(client, new GetObjectCommand({ Bucket: process.env.STORAGE_S3_NAME, Key: 'smoke.txt' })));
      assert.equal(url.hostname, process.env.STORAGE_S3_NAME + '.' + new URL(process.env.STORAGE_S3_ENDPOINT).hostname);
      delete process.env.STORAGE_S3_FORCE_PATH_STYLE;
      assert.equal(factory.createDriver().delegate.client.config.forcePathStyle, true);
      console.log('Compiled S3 virtual-host signing and legacy default verified.');
    })().catch(() => process.exit(1));
  `,
  );
  const unauthorized = await docker(
    'exec',
    `${prefix}-redis`,
    'redis-cli',
    'PING',
  );
  if (!unauthorized.includes('NOAUTH'))
    throw new Error('Redis authentication is not enforced');
  const redisCli = (command) =>
    docker(
      'exec',
      `${prefix}-redis`,
      'sh',
      '-c',
      `REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli ${command}`,
    );
  await redisCli('SET crm-smoke persisted');
  const pgQuery = (query) =>
    docker(
      'exec',
      `${prefix}-pg`,
      'psql',
      '-U',
      'twenty',
      '-d',
      'twenty',
      '-tAc',
      query,
    );
  await pgQuery(
    "CREATE TABLE crm_smoke_persistence (value text); INSERT INTO crm_smoke_persistence VALUES ('persisted')",
  );
  await docker('stop', `${prefix}-pg`, `${prefix}-redis`);
  await docker('start', `${prefix}-pg`, `${prefix}-redis`);
  await waitUntilReady(
    async () => {
      if (
        (await pgQuery('SELECT value FROM crm_smoke_persistence')).trim() !==
        'persisted'
      )
        throw new Error('Database persistence failed');
      if ((await redisCli('GET crm-smoke')).trim() !== 'persisted')
        throw new Error('Redis persistence failed');
    },
    {
      label: 'PostgreSQL and Redis persistence',
      timeoutMs: 60_000,
      intervalMs: 1_000,
    },
  );
  console.log(
    'PASS: fresh migrations, health, worker startup, Redis authentication and database/queue persistence.',
  );
  console.log(
    'Native Railway bucket upload/download and Railway networking still require a cloud acceptance test.',
  );
} catch (error) {
  // Docker/app output can contain credentials. Keep the error short and redacted.
  console.error(
    'Smoke test failed. No existing containers or databases were touched.',
  );
  if (error.message?.startsWith('Timed out')) console.error(error.message);
  for (const name of containers.filter((name) => /server|worker/.test(name))) {
    const logs = await docker('logs', '--tail', '30', name).catch(
      () => 'Logs unavailable.',
    );
    let safeLogs = logs;
    for (const value of redactedValues)
      safeLogs = safeLogs.replaceAll(value, '[REDACTED]');
    console.error(`${name}:\n${safeLogs}`);
  }
  process.exitCode = 1;
} finally {
  for (const container of containers.reverse())
    await docker('rm', '-f', container).catch(() => {});
  for (const volume of volumes)
    await docker('volume', 'rm', volume).catch(() => {});
  await docker('network', 'rm', prefix).catch(() => {});
  await rm(directory, { recursive: true, force: true });
}
