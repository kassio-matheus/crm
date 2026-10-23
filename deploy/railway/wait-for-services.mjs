import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

export async function waitUntilReady(
  check,
  { label, timeoutMs = 600_000, intervalMs = 2_000, log = console.log },
) {
  const deadline = Date.now() + timeoutMs;
  let attempts = 0;
  while (Date.now() < deadline) {
    try {
      await check();
      log(`${label} is ready.`);
      return;
    } catch {
      // Driver errors may contain connection URLs or credentials. Never log them.
      if (attempts++ % 15 === 0) log(`Waiting for ${label}...`);
      await delay(Math.min(intervalMs, Math.max(0, deadline - Date.now())));
    }
  }
  throw new Error(`Timed out waiting for ${label}. Check its service logs.`);
}

export async function waitForServices(env = process.env) {
  const require = createRequire('/app/packages/twenty-server/package.json');
  const { Client } = require('pg');
  const Redis = require('ioredis');
  await waitUntilReady(
    async () => {
      const client = new Client({
        connectionString: env.PG_DATABASE_URL,
        connectionTimeoutMillis: 3_000,
        query_timeout: 3_000,
      });
      client.on('error', () => {});
      try {
        await client.connect();
        await client.query('SELECT 1');
      } finally {
        await client.end().catch(() => {});
      }
    },
    { label: 'PostgreSQL' },
  );
  await waitUntilReady(
    async () => {
      const redis = new Redis(env.REDIS_URL, {
        lazyConnect: true,
        retryStrategy: () => null,
        connectTimeout: 3_000,
        commandTimeout: 3_000,
        maxRetriesPerRequest: 0,
      });
      redis.on('error', () => {});
      try {
        await redis.connect();
        await redis.ping();
      } finally {
        redis.disconnect();
      }
    },
    { label: 'Redis' },
  );
  if (env.TWENTY_PROCESS === 'worker') {
    const healthUrl = new URL('/healthz', env.TWENTY_INTERNAL_URL);
    await waitUntilReady(
      async () => {
        const response = await fetch(healthUrl, {
          signal: AbortSignal.timeout(3_000),
        });
        await response.body?.cancel();
        if (!response.ok) throw new Error('Server not ready');
      },
      { label: 'Twenty server and database migrations', timeoutMs: 900_000 },
    );
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  waitForServices().catch(() => {
    console.error(
      'Dependencies are unavailable. Check database, Redis and server health.',
    );
    process.exitCode = 1;
  });
}
