import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('twenty-sdk/logic-function', () => ({ kv: {} }));
import { RdOAuthService } from '../rd-oauth-service';
import { IMPORT_LAYOUT } from 'src/constants/rd-identifiers';
import type { MetadataApiClient } from 'twenty-client-sdk/metadata';
import type { RdOAuthClient } from 'src/rd-client/rd-oauth-client';
import type { kv } from 'twenty-sdk/logic-function';

const callbackUrl = 'https://crm.test/s/rd-station/oauth/callback';
let raw: string;
let clock: number;
let sequence: number;
let entries: Map<string, unknown>;
const query = vi.fn();
const mutation = vi.fn();
const exchange = vi.fn();
let store: Pick<typeof kv, 'get' | 'set' | 'delete'>;
const service = () =>
  new RdOAuthService(
    store,
    { query, mutation } as unknown as MetadataApiClient,
    { exchange } as unknown as RdOAuthClient,
    () => raw,
    callbackUrl,
    () => clock,
    () => (++sequence).toString(16).padStart(64, '0'),
  );
beforeEach(() => {
  vi.clearAllMocks();
  clock = 1000;
  sequence = 0;
  entries = new Map();
  raw = JSON.stringify({
    version: 'v2',
    accountKey: 'acme',
    clientId: 'client',
    clientSecret: 'SECRET',
  });
  store = {
    get: vi.fn(async (key) => entries.get(key) ?? null),
    set: vi.fn(async (key, value) => {
      entries.set(key, value);
    }),
    delete: vi.fn(async (key) => entries.delete(key)),
  } as Pick<typeof kv, 'get' | 'set' | 'delete'>;
  query.mockImplementation(async (input) =>
    input.getPageLayouts
      ? {
          getPageLayouts: [
            {
              id: '44444444-4444-4444-8444-444444444444',
              universalIdentifier: IMPORT_LAYOUT,
            },
          ],
        }
      : {
          findOneApplication: {
            id: 'app',
            applicationVariables: [{ key: 'RD_CREDENTIALS', value: raw }],
          },
        },
  );
  mutation.mockResolvedValue({});
  exchange.mockResolvedValue({
    access_token: 'ACCESS',
    refresh_token: 'REFRESH',
  });
});
const pending = async () => {
  const result = await service().start();
  return new URL(result.authorizationUrl).searchParams.get('state')!;
};
describe('state-bound RD authorization', () => {
  it('prepares a public-client authorization link with a matching callback, no secrets and no RD network call', async () => {
    const result = await service().start();
    expect(result.authorizationUrl).toMatch(
      /^https:\/\/accounts.rdstation.com\/oauth\/authorize/,
    );
    expect(
      new URL(result.authorizationUrl).searchParams.get('redirect_uri'),
    ).toBe(callbackUrl);
    expect(JSON.stringify(result)).not.toContain('SECRET');
    expect(exchange).not.toHaveBeenCalled();
    expect(mutation).not.toHaveBeenCalled();
  });
  it('requires administrator permissions before storing state', async () => {
    query.mockRejectedValue(new Error('Forbidden'));
    await expect(service().start()).rejects.toThrow('Forbidden');
    expect(store.set).not.toHaveBeenCalled();
    expect(exchange).not.toHaveBeenCalled();
  });
  it('stores returned tokens only in encrypted application variables and consumes state once', async () => {
    const state = await pending();
    expect(await service().complete({ state, code: 'CODE' })).toBe(
      '/page/44444444-4444-4444-8444-444444444444',
    );
    expect(exchange).toHaveBeenCalledWith(
      'client',
      'SECRET',
      'CODE',
      callbackUrl,
    );
    expect(
      JSON.parse(
        mutation.mock.calls[0][0].updateOneApplicationVariable.__args.value,
      ),
    ).toMatchObject({ accessToken: 'ACCESS', refreshToken: 'REFRESH' });
    await expect(service().complete({ state, code: 'CODE' })).rejects.toThrow(
      'RD_OAUTH_INVALID_STATE',
    );
    expect(exchange).toHaveBeenCalledTimes(1);
  });
  it('atomically refuses concurrent replay before a second token request', async () => {
    const state = await pending();
    const results = await Promise.allSettled([
      service().complete({ state, code: 'CODE' }),
      service().complete({ state, code: 'CODE' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(exchange).toHaveBeenCalledTimes(1);
    expect(mutation).toHaveBeenCalledTimes(1);
  });
  it('refuses expired, unknown and superseded state without contacting RD', async () => {
    const state = await pending();
    clock += 600_001;
    await expect(service().complete({ state, code: 'CODE' })).rejects.toThrow(
      'RD_OAUTH_INVALID_STATE',
    );
    clock = 1000;
    await pending();
    await expect(service().complete({ state, code: 'CODE' })).rejects.toThrow(
      'RD_OAUTH_INVALID_STATE',
    );
    await expect(
      service().complete({ state: 'bad', code: 'CODE' }),
    ).rejects.toThrow('RD_OAUTH_INVALID_STATE');
    expect(exchange).not.toHaveBeenCalled();
  });
  it('refuses a changed company/client before exchanging or overwriting tokens', async () => {
    const state = await pending();
    raw = raw.replace('acme', 'other-company');
    await expect(service().complete({ state, code: 'CODE' })).rejects.toThrow(
      'RD_OAUTH_CONFIG_CHANGED',
    );
    expect(exchange).not.toHaveBeenCalled();
    expect(mutation).not.toHaveBeenCalled();
  });
  it('does not overwrite configuration edited while the token request was pending', async () => {
    const state = await pending();
    exchange.mockImplementation(async () => {
      raw = raw.replace('acme', 'other-company');
      return { access_token: 'ACCESS', refresh_token: 'REFRESH' };
    });
    await expect(service().complete({ state, code: 'CODE' })).rejects.toThrow(
      'RD_OAUTH_CONFIG_CHANGED',
    );
    expect(mutation).not.toHaveBeenCalled();
  });
  it('handles denied consent without a token request', async () => {
    const state = await pending();
    await expect(
      service().complete({ state, error: 'access_denied' }),
    ).rejects.toThrow('RD_OAUTH_AUTHORIZATION_DENIED');
    expect(exchange).not.toHaveBeenCalled();
    expect(mutation).not.toHaveBeenCalled();
  });
  it('reports configuration status without returning secrets or tokens', async () => {
    raw = JSON.stringify({
      ...JSON.parse(raw),
      accessToken: 'ACCESS',
      refreshToken: 'REFRESH',
    });
    const result = await service().status();
    expect(result.connected).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/SECRET|ACCESS|REFRESH/);
  });
});
