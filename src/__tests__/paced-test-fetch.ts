// The test API key is limited to 100 requests/minute. Keep the real limit enabled.
const originalFetch = globalThis.fetch.bind(globalThis);
let nextRequestAt = Date.now();
globalThis.fetch = async (input, init) => {
  const url = new URL(
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
  );
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.port !== '2021')
    return originalFetch(input, init);
  for (let attempt = 0; attempt < 3; attempt++) {
    const wait = Math.max(0, nextRequestAt - Date.now());
    nextRequestAt = Math.max(Date.now(), nextRequestAt) + 850;
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    const response = await originalFetch(input, init);
    if (response.status !== 429 || attempt === 2) return response;
    const retry = Number(response.headers.get('retry-after'));
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Number.isFinite(retry) && retry > 0
          ? Math.min(60_000, retry * 1000)
          : 60_000,
      ),
    );
  }
  throw new Error('Isolated test request retry exhausted.');
};
