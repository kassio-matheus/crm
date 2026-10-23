import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RdClient } from '../rd-client';
const v1 = {
  version: 'v1' as const,
  accountKey: 'acme',
  accessToken: 'SECRET',
};
const v2 = {
  ...v1,
  version: 'v2' as const,
  clientId: 'id',
  clientSecret: 'secret',
  refreshToken: 'refresh',
};
const fetcher = vi.fn<typeof fetch>();
const save = vi.fn();
beforeEach(() => {
  fetcher.mockReset();
  save.mockReset();
});
describe('RdClient', () => {
  it('uses documented v1 pagination and keeps token off headers', async () => {
    fetcher.mockResolvedValue(
      new Response(JSON.stringify({ deals: [{ id: 'a' }], has_more: false })),
    );
    const page = await new RdClient(v1, save, fetcher).list('deals', 2);
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(fetcher.mock.calls[0][1]?.method).toBe('GET');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('token')).toBe('SECRET');
    expect(page.records).toHaveLength(1);
    expect(page.hasMore).toBe(false);
  });
  it('uses v2 bearer tokens and link pagination', async () => {
    fetcher.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: 'a' }],
          links: {
            next: 'https://api.rd.services/crm/v2/deals?page[number]=2',
          },
        }),
      ),
    );
    const result = await new RdClient(v2, save, fetcher).list('deals', 1);
    expect(result.hasMore).toBe(true);
    expect(fetcher.mock.calls[0][1]?.method).toBe('GET');
    expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: 'Bearer SECRET',
    });
  });
  it.each([
    'https://evil.test/crm/v2/deals',
    'http://api.rd.services/crm/v2/deals',
    'https://api.rd.services/oauth2/token',
    '//evil.test/crm/v2/deals',
  ])('rejects hostile next links %s', async (next) => {
    await expect(
      new RdClient(v2, save, fetcher).list('deals', 2, next),
    ).rejects.toThrow('Unsafe');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not follow redirects with credentials', async () => {
    fetcher.mockRejectedValue(new Error('redirect to evil?token=SECRET'));
    await expect(
      new RdClient(v1, save, fetcher).list('deals', 1),
    ).rejects.toThrow('RD_CONNECTION_FAILED');
    expect(fetcher.mock.calls[0][1]?.redirect).toBe('error');
  });
  it('honors Retry-After without retrying inline', async () => {
    fetcher.mockResolvedValue(
      new Response('{}', { status: 429, headers: { 'Retry-After': '125' } }),
    );
    await expect(
      new RdClient(v2, save, fetcher).list('deals', 1),
    ).rejects.toThrow('RD_RETRY:125000');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('persists the rotated refresh token before scheduling a retry', async () => {
    fetcher
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: 'NEW', refresh_token: 'ROTATED' }),
        ),
      );
    await expect(
      new RdClient(v2, save, fetcher).list('deals', 1),
    ).rejects.toThrow('RD_TOKEN_REFRESHED');
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'NEW', refreshToken: 'ROTATED' }),
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('fails closed for a malformed list', async () => {
    fetcher.mockResolvedValue(new Response('{"error":"SECRET"}'));
    await expect(
      new RdClient(v1, save, fetcher).list('deals', 1),
    ).rejects.toThrow('Unexpected');
  });
  it('stops at the v1 10,000 record boundary', async () => {
    fetcher.mockResolvedValue(
      new Response(
        JSON.stringify({
          deals: Array.from({ length: 25 }, (_, i) => ({ id: String(i) })),
          has_more: false,
        }),
      ),
    );
    await expect(
      new RdClient(v1, save, fetcher).list('deals', 400),
    ).rejects.toThrow('RD_V1_LIST_LIMIT');
  });
  it('uses the v1 stage endpoint maximum page size', async () => {
    fetcher.mockResolvedValue(
      new Response('{"deal_stages":[],"has_more":false}'),
    );
    await new RdClient(v1, save, fetcher).list(
      'deal_stages?deal_pipeline_id=p',
      1,
    );
    expect(
      new URL(String(fetcher.mock.calls[0][0])).searchParams.get('limit'),
    ).toBe('12');
  });
});

describe('single-record source details', () => {
  it('fetches v1 deal history without list pagination', async () => {
    fetcher.mockResolvedValue(
      new Response('{"id":"deal","deal_stage_histories":[]}'),
    );
    const result = await new RdClient(v1, save, fetcher).list(
      'deals/deal',
      1,
      null,
      true,
    );
    expect(result.records[0].id).toBe('deal');
    expect(result.hasMore).toBe(false);
    expect(
      new URL(String(fetcher.mock.calls[0][0])).searchParams.has('limit'),
    ).toBe(false);
  });
});
