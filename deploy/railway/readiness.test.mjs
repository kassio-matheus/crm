import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waitUntilReady } from './wait-for-services.mjs';
import { adaptStorageFactory } from './storage-compat.mjs';

test('retries failed dependencies and never logs driver credentials', async () => {
  let attempts = 0;
  const logs = [];
  await waitUntilReady(
    async () => {
      if (++attempts < 3)
        throw new Error('postgres://private-password@internal');
    },
    {
      label: 'database',
      timeoutMs: 500,
      intervalMs: 1,
      log: (message) => logs.push(message),
    },
  );
  assert.equal(attempts, 3);
  assert.doesNotMatch(logs.join(), /private-password/);
  assert.match(logs.at(-1), /ready/);
});
test('dependency failure is bounded and reports only the service label', async () => {
  await assert.rejects(
    waitUntilReady(
      async () => {
        throw new Error('secret');
      },
      { label: 'Redis', timeoutMs: 10, intervalMs: 1, log: () => {} },
    ),
    /Timed out waiting for Redis/,
  );
});
test('refuses to patch an unknown Twenty storage implementation', () => {
  assert.throws(
    () => adaptStorageFactory('forcePathStyle: true,'),
    /Unsupported Twenty/,
  );
});
