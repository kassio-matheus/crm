import {
  bucket,
  defineRailway,
  github,
  image,
  project,
  ref,
  service,
  volume,
} from 'railway/iac';

// Repository source must be available to the Railway GitHub integration.
export const repository = 'kassio-matheus/crm';
const region = 'us-east4-eqdc4a';
const secret = () => ({
  generator: 'secret(64, "0123456789abcdef")',
  preserveExisting: true,
});
const deployment = {
  region,
  numReplicas: 1,
  restartPolicyType: 'ON_FAILURE' as const,
  restartPolicyMaxRetries: 10,
  sleepApplication: false,
};
const build = {
  builder: 'DOCKERFILE' as const,
  dockerfilePath: 'deploy/railway/Dockerfile',
  watchPatterns: [
    '/deploy/railway/**',
    '/deploy/native-ui/**',
    '/.dockerignore',
  ],
};

export default defineRailway(() => {
  const postgresData = volume('Postgres Data', { sizeMB: 10240, region });
  const redisData = volume('Redis Data', { sizeMB: 1024, region });
  const storage = bucket('Storage', { region: 'iad' });
  // Explicit services keep the database and queue private (no public TCP proxy).
  const postgres = service('Postgres', {
    source: image(
      'postgres:16-alpine@sha256:f4610795587492cd4fb887c2dc3de301b813278bb6f616992061141b5f15ac36',
    ),
    start: "docker-entrypoint.sh postgres -c listen_addresses='*'",
    deploy: { ...deployment, requiredMountPath: '/var/lib/postgresql/data' },
    volumeMounts: { '/var/lib/postgresql/data': postgresData },
    env: {
      POSTGRES_DB: 'twenty',
      POSTGRES_USER: 'twenty',
      POSTGRES_PASSWORD: secret(),
      PGDATA: '/var/lib/postgresql/data/pgdata',
      DATABASE_URL:
        'postgresql://${{POSTGRES_USER}}:${{POSTGRES_PASSWORD}}@${{RAILWAY_PRIVATE_DOMAIN}}:5432/${{POSTGRES_DB}}',
      RAILWAY_DEPLOYMENT_DRAINING_SECONDS: '60',
    },
  });
  const redis = service('Redis', {
    source: github(repository, { branch: 'main' }),
    build: { ...build, dockerfilePath: 'deploy/railway/redis/Dockerfile' },
    deploy: { ...deployment, requiredMountPath: '/data' },
    volumeMounts: { '/data': redisData },
    env: {
      REDIS_PASSWORD: secret(),
      REDIS_URL:
        'redis://default:${{REDIS_PASSWORD}}@${{RAILWAY_PRIVATE_DOMAIN}}:6379',
    },
  });
  const twenty = service('Twenty', {
    source: github(repository, { branch: 'main' }),
    build,
    start: '/app/railway-entrypoint.sh node dist/main',
    healthcheck: '/healthz',
    healthcheckTimeout: 600,
    deploy: deployment,
    env: {
      NODE_ENV: 'production',
      NODE_PORT: '3000',
      PORT: '3000',
      SERVER_URL: 'https://${{RAILWAY_PUBLIC_DOMAIN}}',
      PG_DATABASE_URL: postgres.env.DATABASE_URL,
      REDIS_URL: redis.env.REDIS_URL,
      ENCRYPTION_KEY: secret(),
      APP_SECRET: secret(),
      STORAGE_TYPE: 's3',
      STORAGE_S3_ENDPOINT: ref(storage, 'ENDPOINT'),
      STORAGE_S3_NAME: ref(storage, 'BUCKET'),
      STORAGE_S3_REGION: ref(storage, 'REGION'),
      STORAGE_S3_ACCESS_KEY_ID: ref(storage, 'ACCESS_KEY_ID'),
      STORAGE_S3_SECRET_ACCESS_KEY: ref(storage, 'SECRET_ACCESS_KEY'),
      STORAGE_S3_FORCE_PATH_STYLE: 'false',
      // Files go through Twenty's authenticated API; no public bucket or browser CORS.
      STORAGE_S3_PRESIGNED_URL_ENABLED: 'false',
      SIGN_IN_PREFILLED: 'false',
      IS_MULTIWORKSPACE_ENABLED: 'false',
      IS_CONFIG_VARIABLES_IN_DB_ENABLED: 'false',
      IS_BILLING_ENABLED: 'false',
      // Single-company profile: only trusted admins may install executable app code.
      LOGIC_FUNCTION_TYPE: 'LOCAL',
      TRUSTED_LOCAL_FUNCTIONS: 'true',
      CODE_INTERPRETER_TYPE: 'DISABLED',
      EMAIL_DRIVER: { value: 'LOGGER', preserveExisting: true },
      EMAIL_FROM_ADDRESS: {
        value: 'noreply@yourdomain.com',
        preserveExisting: true,
      },
      EMAIL_FROM_NAME: { value: 'CRM', preserveExisting: true },
      EMAIL_SMTP_HOST: { value: '', preserveExisting: true },
      EMAIL_SMTP_PORT: { value: '587', preserveExisting: true },
      EMAIL_SMTP_USER: { value: '', preserveExisting: true },
      EMAIL_SMTP_PASSWORD: { value: '', preserveExisting: true },
      EMAIL_SMTP_NO_TLS: { value: 'false', preserveExisting: true },
      AI_PROVIDERS: { value: '{}', preserveExisting: true },
      DISABLE_DB_MIGRATIONS: 'false',
      DISABLE_CRON_JOBS_REGISTRATION: 'false',
      TWENTY_PROCESS: 'server',
    },
  });
  const worker = service('Twenty Worker', {
    source: github(repository, { branch: 'main' }),
    build,
    start: '/app/railway-entrypoint.sh yarn worker:prod',
    deploy: deployment,
    env: {
      ...Object.fromEntries(
        Object.keys(twenty.variables ?? {}).map((key) => [
          key,
          ref(twenty, key),
        ]),
      ),
      TWENTY_PROCESS: 'worker',
      TWENTY_INTERNAL_URL: 'http://${{Twenty.RAILWAY_PRIVATE_DOMAIN}}:3000',
      DISABLE_DB_MIGRATIONS: 'true',
      DISABLE_CRON_JOBS_REGISTRATION: 'true',
    },
  });
  // The SDK exposes backup schedules on graph attachments, not volume() options.
  for (const database of [postgres, redis])
    for (const attachment of Object.values(database.volumeAttachments ?? {}))
      attachment.backupSchedules = ['DAILY', 'WEEKLY'];
  return project('Twenty Sales CRM', {
    resources: [
      postgresData,
      redisData,
      storage,
      postgres,
      redis,
      twenty,
      worker,
    ],
  });
});
