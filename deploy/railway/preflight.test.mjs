import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionEnvironment } from './preflight.mjs';
const valid = () => ({
  NODE_ENV: 'production',
  SERVER_URL: 'https://crm.example.com',
  PG_DATABASE_URL:
    'postgres://example:example@postgres.railway.internal:5432/railway',
  REDIS_URL: 'redis://redis.railway.internal:6379',
  ENCRYPTION_KEY: 'a'.repeat(44),
  APP_SECRET: 'b'.repeat(44),
  STORAGE_TYPE: 's3',
  STORAGE_S3_ENDPOINT: 'https://storage.example.com',
  STORAGE_S3_NAME: 'private-bucket',
  STORAGE_S3_REGION: 'region',
  STORAGE_S3_ACCESS_KEY_ID: 'example-id',
  STORAGE_S3_SECRET_ACCESS_KEY: 'example-secret',
  SIGN_IN_PREFILLED: 'false',
  IS_CONFIG_VARIABLES_IN_DB_ENABLED: 'false',
  CODE_INTERPRETER_TYPE: 'DISABLED',
  LOGIC_FUNCTION_TYPE: 'LOCAL',
  TRUSTED_LOCAL_FUNCTIONS: 'true',
});
test('accepts the explicit single-tenant trusted code profile', () =>
  assert.deepEqual(validateProductionEnvironment(valid()), []));
test('rejects missing production secrets without exposing their values', () => {
  const env = valid();
  env.ENCRYPTION_KEY = 'PRIVATE';
  const errors = validateProductionEnvironment(env).join('\n');
  assert.match(errors, /ENCRYPTION_KEY/);
  assert.doesNotMatch(errors, /PRIVATE/);
});
test('rejects local storage, development defaults and public HTTP', () => {
  const env = {
    ...valid(),
    NODE_ENV: 'development',
    SERVER_URL: 'http://localhost:2020',
    STORAGE_TYPE: 'local',
    APP_SECRET: 'twenty-app-dev-secret-not-for-production',
    SIGN_IN_PREFILLED: 'true',
  };
  assert.ok(validateProductionEnvironment(env).length >= 5);
});
test('requires explicit opt-in for unsandboxed local functions', () => {
  const env = valid();
  delete env.TRUSTED_LOCAL_FUNCTIONS;
  assert.match(validateProductionEnvironment(env).join('\n'), /LAMBDA/);
});
test('requires Lambda infrastructure before starting the isolated runtime profile', () => {
  const env = { ...valid(), LOGIC_FUNCTION_TYPE: 'LAMBDA' };
  assert.match(validateProductionEnvironment(env).join('\n'), /LAMBDA_ROLE/);
  Object.assign(env, {
    LOGIC_FUNCTION_LAMBDA_REGION: 'us-east-1',
    LOGIC_FUNCTION_LAMBDA_ROLE: 'arn:aws:iam::123456789012:role/example',
    LOGIC_FUNCTION_LAMBDA_ACCESS_KEY_ID: 'example',
    LOGIC_FUNCTION_LAMBDA_SECRET_ACCESS_KEY: 'example',
    LOGIC_FUNCTION_LAMBDA_LAYER_BUCKET: 'layers',
  });
  assert.deepEqual(validateProductionEnvironment(env), []);
});
test('rejects reused encryption and application secrets', () => {
  const env = valid();
  env.APP_SECRET = env.ENCRYPTION_KEY;
  assert.match(validateProductionEnvironment(env).join('\n'), /independent/);
});

test('rejects a worker without a private server readiness endpoint', () => {
  assert.match(
    validateProductionEnvironment({
      ...valid(),
      TWENTY_PROCESS: 'worker',
    }).join('\n'),
    /TWENTY_INTERNAL_URL/,
  );
});
