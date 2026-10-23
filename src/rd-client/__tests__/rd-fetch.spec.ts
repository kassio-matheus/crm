import { describe, expect, it, vi } from 'vitest';
import { rdFetch } from '../rd-fetch';

describe('RD read-only boundary', () => {
  it('blocks method tunneling through query parameters or headers', async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      rdFetch(
        'https://api.rd.services/crm/v2/deals?_method=DELETE',
        { method: 'GET' },
        fetcher,
      ),
    ).rejects.toThrow('RD_READ_ONLY_POLICY');
    await expect(
      rdFetch(
        'https://api.rd.services/crm/v2/deals',
        { method: 'GET', headers: { 'X-HTTP-Method-Override': 'PATCH' } },
        fetcher,
      ),
    ).rejects.toThrow('RD_READ_ONLY_POLICY');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])(
    'blocks %s on every RD business API before the network',
    async (method) => {
      for (const url of [
        'https://api.rd.services/crm/v2/deals',
        'https://crm.rdstation.com/api/v1/contacts',
        'https://accounts.rdstation.com/oauth/authorize',
      ]) {
        const fetcher = vi.fn<typeof fetch>();
        await expect(rdFetch(url, { method }, fetcher)).rejects.toThrow(
          'RD_READ_ONLY_POLICY',
        );
        expect(fetcher).not.toHaveBeenCalled();
      }
    },
  );
  it.each([
    'https://api.rd.services/oauth2/token?x=1',
    'https://api.rd.services/oauth2/token#x',
    'https://api.rd.services/oauth2/token/',
    'http://api.rd.services/oauth2/token',
    'https://evil.rd.services/oauth2/token',
  ])('denies OAuth lookalike endpoint %s', async (url) => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      rdFetch(
        url,
        {
          method: 'POST',
          body: new URLSearchParams({ grant_type: 'refresh_token' }),
        },
        fetcher,
      ),
    ).rejects.toThrow('RD_READ_ONLY_POLICY');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(['authorization_code', 'refresh_token'])(
    'permits only the approved OAuth grant %s at the exact token endpoint',
    async (grant) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('{}'));
      await rdFetch(
        'https://api.rd.services/oauth2/token',
        {
          method: 'POST',
          redirect: 'follow',
          body: new URLSearchParams({ grant_type: grant }),
        },
        fetcher,
      );
      expect(fetcher.mock.calls[0][1]).toMatchObject({
        method: 'POST',
        redirect: 'error',
      });
    },
  );
  it('rejects unapproved token grants and GET bodies', async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      rdFetch(
        'https://api.rd.services/oauth2/token',
        {
          method: 'POST',
          body: new URLSearchParams({ grant_type: 'client_credentials' }),
        },
        fetcher,
      ),
    ).rejects.toThrow('RD_READ_ONLY_POLICY');
    await expect(
      rdFetch(
        'https://api.rd.services/crm/v2/contacts',
        { method: 'GET', body: 'mutation' },
        fetcher,
      ),
    ).rejects.toThrow('RD_READ_ONLY_POLICY');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('forces GET and disables redirects on a normal data read', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
    await rdFetch('https://api.rd.services/crm/v2/deals', {}, fetcher);
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      redirect: 'error',
    });
  });
  it('preserves PUT to the owned Twenty storage target', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
    await rdFetch(
      'https://crm.example.test/file-upload/id',
      { method: 'PUT', body: 'file' },
      fetcher,
    );
    expect(fetcher.mock.calls[0][1]?.method).toBe('PUT');
  });
});
