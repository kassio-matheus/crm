import type { RdCredentials } from 'src/types/rd-credentials';
import { rdFetch } from 'src/rd-client/rd-fetch';
import { RdOAuthClient } from 'src/rd-client/rd-oauth-client';
import { rdPaginationUrl } from 'src/utils/rd-pagination-url.util';
import type { RdListOptions } from 'src/types/rd-list-options';

/** One request per worker run, including retries and OAuth refreshes. Never log URLs or response bodies. */
export class RdClient {
  constructor(
    private credentials: RdCredentials,
    private save: (value: RdCredentials) => Promise<void>,
    private fetcher: typeof fetch = fetch,
  ) {}

  async list(
    path: string,
    page: number,
    nextPath: string | null = null,
    single = false,
    options?: RdListOptions,
  ): Promise<{
    records: Record<string, unknown>[];
    next: string | null;
    hasMore: boolean;
  }> {
    const version = this.credentials.version;
    const url = rdPaginationUrl(version, path, nextPath);
    if (!nextPath && !single) {
      url.searchParams.set(
        version === 'v1' ? 'page' : 'page[number]',
        String(page),
      );
      url.searchParams.set(
        version === 'v1' ? 'limit' : 'page[size]',
        options?.size
          ? String(options.size)
          : path.endsWith('/files')
            ? '1'
            : version === 'v1' && path.startsWith('deal_stages')
              ? '12'
              : '25',
      );
    }
    if (!single && version === 'v2' && options) {
      const expected = rdPaginationUrl(version, path);
      if (options.sort)
        expected.searchParams.set(`sort[${options.sort}]`, 'desc');
      if (options.upper) {
        if (!Number.isFinite(Date.parse(options.upper)))
          throw new Error('RD_INVALID_WINDOW');
        const existing = expected.searchParams.get('filter');
        expected.searchParams.set(
          'filter',
          `${existing ? `(${existing}) ` : ''}created_at:<=\"${options.upper}\"`,
        );
      }
      for (const key of ['filter', 'sort[created_at]', 'sort[updated_at]']) {
        const value = expected.searchParams.get(key);
        if (nextPath && (url.searchParams.get(key) ?? '') !== (value ?? ''))
          throw new Error('Unsafe pagination filter returned by RD Station.');
        if (value !== null) url.searchParams.set(key, value);
      }
    }
    if (
      !single &&
      !nextPath &&
      ['deals', 'contacts', 'organizations'].includes(path) &&
      !options
    ) {
      url.searchParams.set(
        version === 'v1' ? 'order' : 'sort[created_at]',
        version === 'v1' ? 'created_at' : 'asc',
      );
      if (version === 'v1') url.searchParams.set('direction', 'asc');
    }
    if (version === 'v1')
      url.searchParams.set('token', this.credentials.accessToken);
    url.searchParams.sort();
    let response: Response;
    try {
      response = await rdFetch(
        url,
        {
          method: 'GET',
          headers:
            version === 'v2'
              ? {
                  Authorization: `Bearer ${this.credentials.accessToken}`,
                  Accept: 'application/json',
                }
              : { Accept: 'application/json' },
          redirect: 'error',
          signal: AbortSignal.timeout(30_000),
        },
        this.fetcher,
      );
    } catch {
      throw new Error('RD_CONNECTION_FAILED');
    }
    if (response.status === 401 && version === 'v2') {
      await this.refresh();
      // Do not retry inline: the scheduler applies the account rate budget to the retry too.
      throw new Error('RD_TOKEN_REFRESHED');
    }
    if (response.status === 429 || response.status >= 500) {
      const retry = response.headers.get('Retry-After');
      const delay = retry
        ? /^\d+(\.\d+)?$/.test(retry)
          ? Number(retry) * 1000
          : Date.parse(retry) - Date.now()
        : 60_000;
      throw new Error(
        `RD_RETRY:${Math.max(60_000, Number.isFinite(delay) ? delay : 60_000)}`,
      );
    }
    if (!response.ok)
      throw new Error(
        `RD_HTTP_${response.status}. Check the token permissions for this resource.`,
      );
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object')
      throw new Error('Unexpected RD response.');
    const object = body as Record<string, unknown>;
    const kind = path.split('?')[0].split('/').pop() ?? '';
    const records = single
      ? [version === 'v2' ? object.data : object]
      : Array.isArray(body)
        ? body
        : version === 'v2'
          ? object.data
          : object[kind];
    if (
      !Array.isArray(records) ||
      records.some(
        (item) => !item || typeof item !== 'object' || Array.isArray(item),
      )
    )
      throw new Error(`Unexpected RD list response for ${kind}.`);
    const links = object.links as { next?: unknown } | undefined;
    const next =
      typeof links?.next === 'string' && links.next
        ? rdPaginationUrl(version, path, links.next).href
        : null;
    if (next && options) {
      const cursor = new URL(next);
      for (const key of ['filter', 'sort[created_at]', 'sort[updated_at]']) {
        if (
          (cursor.searchParams.get(key) ?? '') !==
          (url.searchParams.get(key) ?? '')
        )
          throw new Error('Unsafe pagination filter returned by RD Station.');
      }
    }
    if (next && next === url.href)
      throw new Error('RD returned a repeated pagination cursor.');
    if (version === 'v1' && page * 25 >= 10_000 && records.length === 25)
      throw new Error(
        'RD_V1_LIST_LIMIT: 10,000 records reached. Use API v2; completeness cannot be guaranteed with this v1 listing.',
      );
    return {
      records: records as Record<string, unknown>[],
      next,
      hasMore: single
        ? false
        : version === 'v2'
          ? Boolean(next)
          : ['users', 'teams'].includes(kind)
            ? false
            : typeof object.has_more === 'boolean'
              ? object.has_more
              : records.length === (kind === 'deal_stages' ? 12 : 25),
    };
  }

  private async refresh(): Promise<void> {
    const { clientId, clientSecret, refreshToken } = this.credentials;
    if (!clientId || !clientSecret || !refreshToken)
      throw new Error('RD_OAUTH_RECONNECT_REQUIRED');
    const tokens = await new RdOAuthClient(this.fetcher).refresh(
      clientId,
      clientSecret,
      refreshToken,
    );
    this.credentials = {
      ...this.credentials,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    };
    await this.save(this.credentials);
  }
}
