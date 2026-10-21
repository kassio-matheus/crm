import { describe, expect, it } from 'vitest';
import { parseCredentials } from '../parse-credentials.util';
describe('parseCredentials', () => {
  it.each([
    undefined,
    '{}',
    'null',
    'false',
    '{bad',
    JSON.stringify({
      version: 'marketing',
      accountKey: 'abc',
      accessToken: 'x',
    }),
    JSON.stringify({
      version: 'v1',
      accountKey: '../x',
      accessToken: 'secret',
    }),
  ])('rejects invalid input without echoing credentials', (input) =>
    expect(() => parseCredentials(input)).toThrow(),
  );
  it('requires rotating credentials for v2', () =>
    expect(() =>
      parseCredentials(
        JSON.stringify({ version: 'v2', accountKey: 'acme', accessToken: 'x' }),
      ),
    ).toThrow('client ID'));
  it('accepts the personal CRM v1 token', () =>
    expect(
      parseCredentials(
        JSON.stringify({ version: 'v1', accountKey: 'acme', accessToken: 'x' }),
      ).accountKey,
    ).toBe('acme'));
});
