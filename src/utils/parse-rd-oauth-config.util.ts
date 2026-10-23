import type { RdOAuthConfig } from 'src/types/rd-oauth-config';

export const parseRdOAuthConfig = (raw: string | undefined): RdOAuthConfig => {
  try {
    const value = JSON.parse(raw ?? '') as Partial<RdOAuthConfig>;
    if (
      value?.version !== 'v2' ||
      !/^[a-z0-9][a-z0-9-]{2,79}$/.test(value.accountKey ?? '') ||
      typeof value.clientId !== 'string' ||
      !value.clientId.trim() ||
      value.clientId.length > 1024 ||
      typeof value.clientSecret !== 'string' ||
      !value.clientSecret.trim() ||
      value.clientSecret.length > 4096
    )
      throw new Error('Invalid configuration.');
    return value as RdOAuthConfig;
  } catch {
    throw new Error('RD_OAUTH_CONFIG_REQUIRED');
  }
};
