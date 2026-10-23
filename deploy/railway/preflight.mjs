import { fileURLToPath } from 'node:url';

/** Fail before migrations on an incomplete production configuration. Never print secret values. */
export const validateProductionEnvironment = (env) => {
  const errors = [];
  const requireValue = (key) => {
    if (
      !env[key] ||
      /REPLACE_WITH|CHANGE_ME|twenty-app-dev|not-for-production/i.test(env[key])
    )
      errors.push(`${key} is missing or still an example value.`);
  };
  for (const key of [
    'SERVER_URL',
    'PG_DATABASE_URL',
    'REDIS_URL',
    'ENCRYPTION_KEY',
    'APP_SECRET',
    'STORAGE_S3_ENDPOINT',
    'STORAGE_S3_NAME',
    'STORAGE_S3_REGION',
    'STORAGE_S3_ACCESS_KEY_ID',
    'STORAGE_S3_SECRET_ACCESS_KEY',
  ])
    requireValue(key);
  if (env.NODE_ENV !== 'production')
    errors.push('NODE_ENV must be production.');
  if (env.STORAGE_TYPE?.toLowerCase() !== 's3')
    errors.push('Use shared S3 storage for server and worker.');
  if (env.SIGN_IN_PREFILLED !== 'false')
    errors.push('SIGN_IN_PREFILLED must be false.');
  if (env.IS_CONFIG_VARIABLES_IN_DB_ENABLED !== 'false')
    errors.push('Use the documented environment-only configuration.');
  for (const key of ['ENCRYPTION_KEY', 'APP_SECRET'])
    if ((env[key]?.length ?? 0) < 32)
      errors.push(`${key} must contain at least 32 characters.`);
  if (env.ENCRYPTION_KEY && env.ENCRYPTION_KEY === env.APP_SECRET)
    errors.push('Use independent encryption and application secrets.');
  try {
    const url = new URL(env.SERVER_URL);
    if (
      url.protocol !== 'https:' ||
      ['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.username ||
      url.password
    )
      errors.push('SERVER_URL must be the public HTTPS origin.');
  } catch {
    errors.push('SERVER_URL is invalid.');
  }
  for (const [key, protocols] of [
    ['PG_DATABASE_URL', ['postgres:', 'postgresql:']],
    ['REDIS_URL', ['redis:', 'rediss:']],
    ['STORAGE_S3_ENDPOINT', ['https:']],
  ]) {
    try {
      if (!protocols.includes(new URL(env[key]).protocol))
        errors.push(`${key} has an unsupported protocol.`);
    } catch {
      errors.push(`${key} is invalid.`);
    }
  }
  if (env.CODE_INTERPRETER_TYPE !== 'DISABLED')
    errors.push('Keep the unused code interpreter disabled.');
  if (env.TWENTY_PROCESS === 'worker') {
    try {
      const url = new URL(env.TWENTY_INTERNAL_URL);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password
      )
        errors.push('TWENTY_INTERNAL_URL must be the private server origin.');
    } catch {
      errors.push('TWENTY_INTERNAL_URL is required for worker readiness.');
    }
  }
  if (env.LOGIC_FUNCTION_TYPE === 'LAMBDA')
    for (const key of [
      'LOGIC_FUNCTION_LAMBDA_REGION',
      'LOGIC_FUNCTION_LAMBDA_ROLE',
      'LOGIC_FUNCTION_LAMBDA_ACCESS_KEY_ID',
      'LOGIC_FUNCTION_LAMBDA_SECRET_ACCESS_KEY',
      'LOGIC_FUNCTION_LAMBDA_LAYER_BUCKET',
    ])
      requireValue(key);
  else if (
    env.LOGIC_FUNCTION_TYPE !== 'LOCAL' ||
    env.TRUSTED_LOCAL_FUNCTIONS !== 'true'
  )
    errors.push(
      'Configure LAMBDA, or explicitly acknowledge trusted LOCAL functions.',
    );
  return errors;
};
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const errors = validateProductionEnvironment(process.env);
  if (errors.length) {
    console.error(
      'Production configuration incomplete:\n' +
        errors.map((e) => `- ${e}`).join('\n'),
    );
    process.exit(1);
  }
  console.log('Production environment preflight passed.');
}
