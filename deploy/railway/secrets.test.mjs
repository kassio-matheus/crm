import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeSharedSecrets,
  initializeServerDefaults,
  sharedSecretNames,
} from '../../scripts/railway-secrets.mjs';
const target = { projectId: 'project', environmentId: 'environment' };
test('creates distinct cryptographic secrets once and preserves them on repeated deployment', () => {
  const stored = {};
  const writes = [];
  const request = (query, args) => {
    if (query.startsWith('query')) return { variables: { ...stored } };
    writes.push(args.input);
    stored[args.input.name] = args.input.value;
    return { variableUpsert: true };
  };
  assert.deepEqual(initializeSharedSecrets(target, { request }), {
    created: 5,
    preserved: 0,
  });
  const before = { ...stored };
  assert.equal(new Set(Object.values(stored)).size, 5);
  for (const value of Object.values(stored))
    assert.match(value, /^[a-f0-9]{64}$/);
  assert.deepEqual(
    initializeSharedSecrets(target, {
      request,
      generate: () => {
        throw new Error('must not generate');
      },
    }),
    { created: 0, preserved: 5 },
  );
  assert.deepEqual(stored, before);
  assert.equal(writes.length, 5);
  for (const write of writes) {
    assert.equal(write.skipDeploys, true);
    assert.equal(write.projectId, target.projectId);
    assert.equal(write.serviceId, undefined);
  }
});
test('fails before writing if an existing key is malformed or reuses the application secret', () => {
  let writes = 0;
  const request = (query) => {
    if (query.startsWith('query'))
      return {
        variables: { CRM_ENCRYPTION_KEY: 'secret(64, "0123456789abcdef")' },
      };
    writes++;
  };
  assert.throws(
    () => initializeSharedSecrets(target, { request }),
    /automatic replacement is disabled/,
  );
  assert.equal(writes, 0);
  const duplicate = Object.fromEntries(
    sharedSecretNames.map((key, index) => [
      key,
      index >= 2 ? 'b'.repeat(64) : String(index).repeat(64),
    ]),
  );
  assert.throws(
    () =>
      initializeSharedSecrets(target, {
        request: () => ({ variables: duplicate }),
      }),
    /independent/,
  );
});
test('initial server defaults do not overwrite configured SMTP or AI credentials', () => {
  const writes = [];
  const request = (query, args) =>
    query.startsWith('query')
      ? {
          variables: {
            EMAIL_DRIVER: 'SMTP',
            EMAIL_SMTP_PASSWORD: 'private',
            AI_PROVIDERS: 'configured',
          },
        }
      : (writes.push(args.input), {});
  initializeServerDefaults(target, {
    request,
    getStatus: () => ({
      services: { edges: [{ node: { id: 'server', name: 'Twenty' } }] },
    }),
  });
  assert.ok(writes.length > 0);
  for (const key of ['EMAIL_DRIVER', 'EMAIL_SMTP_PASSWORD', 'AI_PROVIDERS'])
    assert.ok(!writes.some((item) => item.name === key));
});
