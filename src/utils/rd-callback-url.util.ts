export const rdCallbackUrl = (base = process.env.TWENTY_API_URL): string => {
  try {
    const url = new URL(base ?? '');
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.protocol !== 'https:' &&
        !(
          url.protocol === 'http:' &&
          ['localhost', '127.0.0.1'].includes(url.hostname)
        ))
    )
      throw new Error('Invalid origin.');
    return `${url.origin}/s/rd-station/oauth/callback`;
  } catch {
    throw new Error('RD_OAUTH_CALLBACK_CONFIGURATION_REQUIRED');
  }
};
