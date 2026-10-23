import { describe, expect, it, vi } from 'vitest';
import { RdOAuthClient } from '../rd-oauth-client';

describe('RD OAuth token-only exception', () => {
  it('exchanges the short-lived code only at the fixed token URL', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ access_token: 'access', refresh_token: 'refresh' }),
        ),
      );
    const tokens = await new RdOAuthClient(fetcher).exchange(
      'client',
      'SECRET',
      'CODE',
      'https://crm.test/s/rd-station/oauth/callback',
    );
    expect(tokens.access_token).toBe('access');
    expect(String(fetcher.mock.calls[0][0])).toBe(
      'https://api.rd.services/oauth2/token',
    );
    const options = fetcher.mock.calls[0][1]!;
    expect(options).toMatchObject({ method: 'POST', redirect: 'error' });
    expect((options.body as URLSearchParams).get('grant_type')).toBe(
      'authorization_code',
    );
    expect((options.body as URLSearchParams).get('redirect_uri')).toBe(
      'https://crm.test/s/rd-station/oauth/callback',
    );
    expect(String(fetcher.mock.calls[0][0])).not.toContain('SECRET');
  });
  it('refreshes with the same fixed OAuth endpoint and persists no body itself', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response('{"access_token":"new","refresh_token":"rotated"}'),
      );
    await new RdOAuthClient(fetcher).refresh('client', 'SECRET', 'refresh');
    expect(
      (fetcher.mock.calls[0][1]?.body as URLSearchParams).get('grant_type'),
    ).toBe('refresh_token');
    expect(String(fetcher.mock.calls[0][0])).toBe(
      'https://api.rd.services/oauth2/token',
    );
  });
  it.each([
    new Response('SECRET', { status: 400 }),
    new Response('{"access_token":"SECRET"}'),
  ])('redacts token failures and malformed responses', async (response) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
    await expect(
      new RdOAuthClient(fetcher).refresh('client', 'SECRET', 'refresh'),
    ).rejects.toThrow('RD_OAUTH_RECONNECT_REQUIRED');
  });
});
