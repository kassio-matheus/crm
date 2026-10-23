import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoutePayload } from 'twenty-sdk/logic-function';
const complete = vi.hoisted(() => vi.fn());
vi.mock('src/services/rd-oauth-service', () => ({
  RdOAuthService: class {
    complete = complete;
  },
}));
vi.mock('twenty-client-sdk/metadata', () => ({ MetadataApiClient: class {} }));
vi.mock('src/utils/rd-callback-url.util', () => ({
  rdCallbackUrl: () => 'https://crm.test/s/rd-station/oauth/callback',
}));
import definition from '../rd-oauth-callback';
const context = {
  retryCount: 0,
  maxRetries: 0,
  workspaceId: 'w',
  userWorkspaceId: null,
  workspaceMemberId: null,
};
const event = (query: Record<string, string> = {}, method = 'GET') =>
  ({
    queryStringParameters: query,
    requestContext: { http: { method, path: '/rd-station/oauth/callback' } },
  }) as RoutePayload;
const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
beforeEach(() => vi.clearAllMocks());
describe('RD callback', () => {
  it('is a GET route and gives a credential-free setup response', async () => {
    expect(definition.config.httpRouteTriggerSettings).toMatchObject({
      httpMethod: 'GET',
      isAuthRequired: false,
    });
    const result = (await definition.config.handler(event(), context)) as {
      body: string;
      headers: object;
    };
    expect(result.body).toContain('Callback disponível');
    expect(complete).not.toHaveBeenCalled();
    expect(result.headers).toMatchObject({ 'cache-control': 'no-store' });
  });
  it('rejects non-GET without executing OAuth', async () => {
    const result = (await definition.config.handler(
      event({}, 'POST'),
      context,
    )) as { status: number };
    expect(result.status).toBe(405);
    expect(complete).not.toHaveBeenCalled();
  });
  it('removes authorization parameters by returning only a clean same-origin page link', async () => {
    complete.mockResolvedValue('/page/44444444-4444-4444-8444-444444444444');
    const result = (await definition.config.handler(
      event({ code: 'SECRET_CODE', state: 'SECRET_STATE' }),
      context,
    )) as { body: string };
    expect(result.body).toContain(
      'https://crm.test/page/44444444-4444-4444-8444-444444444444',
    );
    expect(result.body).not.toMatch(/SECRET_CODE|SECRET_STATE/);
  });
  it('logs only an allowlisted failure code', async () => {
    complete.mockRejectedValue(new Error('RD_OAUTH_INVALID_STATE'));
    await definition.config.handler(event({ state: 'SECRET_STATE' }), context);
    expect(warning).toHaveBeenCalledWith('RD_OAUTH_INVALID_STATE');
  });
  it('does not reflect malicious provider errors or secret-bearing exceptions', async () => {
    complete.mockRejectedValue(
      new Error('SECRET_CODE <script>alert(1)</script>'),
    );
    const result = (await definition.config.handler(
      event({ code: 'SECRET_CODE', state: 'STATE', error: '<script>' }),
      context,
    )) as { body: string; status: number };
    expect(result.status).toBe(400);
    expect(result.body).not.toMatch(/SECRET|script|STATE/);
    expect(warning).toHaveBeenCalledWith('RD_OAUTH_CALLBACK_FAILED');
    expect(JSON.stringify(warning.mock.calls)).not.toMatch(/SECRET|script|STATE/);
  });
});
