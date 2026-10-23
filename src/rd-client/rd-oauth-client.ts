import { rdFetch } from 'src/rd-client/rd-fetch';
import type { RdOAuthTokens } from 'src/types/rd-oauth-tokens';

/** OAuth is the only POST exception; this client cannot address business APIs. */
export class RdOAuthClient {
  constructor(private fetcher: typeof fetch = fetch) {}

  async exchange(
    clientId: string,
    clientSecret: string,
    code: string,
    redirectUri: string,
  ) {
    return this.token(
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    );
  }

  async refresh(clientId: string, clientSecret: string, refreshToken: string) {
    return this.token(
      new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    );
  }

  private async token(body: URLSearchParams): Promise<RdOAuthTokens> {
    try {
      const response = await rdFetch(
        'https://api.rd.services/oauth2/token',
        {
          method: 'POST',
          signal: AbortSignal.timeout(30_000),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        },
        this.fetcher,
      );
      if (!response.ok) throw new Error('Token exchange failed.');
      const value = (await response.json()) as Partial<RdOAuthTokens>;
      if (
        typeof value.access_token !== 'string' ||
        !value.access_token ||
        typeof value.refresh_token !== 'string' ||
        !value.refresh_token
      )
        throw new Error('Invalid token response.');
      return {
        access_token: value.access_token,
        refresh_token: value.refresh_token,
      };
    } catch {
      // Never propagate an OAuth response, request URL or credential into logs.
      throw new Error('RD_OAUTH_RECONNECT_REQUIRED');
    }
  }
}
