/** All outbound app HTTP passes here. RD business data can only be read. */
export const rdFetch = async (
  input: string | URL,
  init: RequestInit,
  fetcher: typeof fetch = fetch,
): Promise<Response> => {
  const url = new URL(input);
  const method = (init.method ?? 'GET').toUpperCase();
  const isRd = ['rd.services', 'rdstation.com', 'rdstation.com.br'].some(
    (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
  );
  if (
    isRd &&
    ([...url.searchParams.keys()].some((key) =>
      ['_method', 'method', 'http_method'].includes(key.toLowerCase()),
    ) ||
      ['x-http-method-override', 'x-method-override'].some((key) =>
        new Headers(init.headers).has(key),
      ))
  )
    throw new Error('RD_READ_ONLY_POLICY');
  if (isRd && method !== 'GET') {
    const tokenRequest =
      url.href === 'https://api.rd.services/oauth2/token' &&
      method === 'POST' &&
      init.body instanceof URLSearchParams &&
      ['authorization_code', 'refresh_token'].includes(
        init.body.get('grant_type') ?? '',
      );
    if (!tokenRequest) throw new Error('RD_READ_ONLY_POLICY');
  }
  if (isRd && (url.protocol !== 'https:' || url.username || url.password))
    throw new Error('RD_READ_ONLY_POLICY');
  if (isRd && method === 'GET' && init.body != null)
    throw new Error('RD_READ_ONLY_POLICY');
  // Redirects cannot bypass the destination/method check or forward credentials.
  return fetcher(url, { ...init, method, redirect: 'error' });
};
