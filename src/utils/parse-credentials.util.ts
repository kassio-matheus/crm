import type { RdCredentials } from 'src/types/rd-credentials';

export const parseCredentials = (raw: string | undefined): RdCredentials => {
  let value: Partial<RdCredentials>;
  try {
    value = JSON.parse(raw ?? '');
  } catch {
    throw new Error(
      'Save the RD Station credentials on the import page first.',
    );
  }
  if (
    !value ||
    !['v1', 'v2'].includes(value.version ?? '') ||
    !/^[a-z0-9][a-z0-9-]{2,79}$/.test(value.accountKey ?? '') ||
    typeof value.accessToken !== 'string' ||
    !value.accessToken.trim()
  ) {
    throw new Error(
      'Invalid RD credentials. Provide API version, company key and access token.',
    );
  }
  if (
    value.version === 'v2' &&
    (!value.refreshToken || !value.clientId || !value.clientSecret)
  ) {
    throw new Error(
      'API v2 also requires client ID, client secret and refresh token for long imports.',
    );
  }
  return value as RdCredentials;
};
