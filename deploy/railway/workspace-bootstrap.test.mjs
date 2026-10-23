import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureWorkspaceApplication } from '../../scripts/ensure-workspace-app.mjs';

test('first bootstrap registers only the requested app and existing registration is preserved', () => {
  const identity = { universalIdentifier: 'app-id', name: 'Sales' };
  const calls = [];
  let exists = false;
  const request = (query, variables) => {
    calls.push({ query, variables });
    if (query.startsWith('query'))
      return {
        findApplicationRegistrationByUniversalIdentifier: exists
          ? { id: 'registration' }
          : null,
      };
    if (query.includes('createApplicationRegistration')) {
      exists = true;
      return {};
    }
    return { createDevelopmentApplication: { id: 'installed' } };
  };
  assert.equal(ensureWorkspaceApplication(identity, request).id, 'installed');
  assert.equal(ensureWorkspaceApplication(identity, request).id, 'installed');
  assert.equal(
    calls.filter((c) => c.query.includes('createApplicationRegistration'))
      .length,
    1,
  );
  assert.equal(
    calls.filter((c) => c.query.includes('createDevelopmentApplication'))
      .length,
    2,
  );
  assert.ok(calls.every((c) => !/delete|uninstall|clientSecret/.test(c.query)));
});
