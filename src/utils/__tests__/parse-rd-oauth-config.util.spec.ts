import { describe, expect, it } from 'vitest';
import { parseRdOAuthConfig } from '../parse-rd-oauth-config.util';
describe('draft RD OAuth configuration', () => {
  it('allows a draft without tokens so the authorization flow can begin', () => {
    expect(
      parseRdOAuthConfig(
        JSON.stringify({
          version: 'v2',
          accountKey: 'acme',
          clientId: 'client',
          clientSecret: 'secret',
        }),
      ).accountKey,
    ).toBe('acme');
  });
  it.each([
    undefined,
    '{}',
    '{"clientSecret":"SECRET"}',
    '{"version":"v1"}',
    '{"version":"v2","accountKey":"../bad"}',
  ])('rejects malformed config without reflecting it', (raw) => {
    expect(() => parseRdOAuthConfig(raw)).toThrow('RD_OAUTH_CONFIG_REQUIRED');
  });
});
