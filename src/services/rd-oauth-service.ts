import { createHash, randomBytes } from 'node:crypto';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { kv } from 'twenty-sdk/logic-function';
import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { IMPORT_LAYOUT } from 'src/constants/rd-identifiers';
import { RdOAuthClient } from 'src/rd-client/rd-oauth-client';
import { parseRdOAuthConfig } from 'src/utils/parse-rd-oauth-config.util';
import { rdCallbackUrl } from 'src/utils/rd-callback-url.util';
import { parseCredentials } from 'src/utils/parse-credentials.util';
import type { RdOAuthConfig } from 'src/types/rd-oauth-config';
import type { RdOAuthPending } from 'src/types/rd-oauth-pending';
import type { RdOAuthStatus } from 'src/types/rd-oauth-status';

const activeKey = 'rd:oauth:active';
const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const fingerprint = (config: RdOAuthConfig) =>
  digest(
    JSON.stringify([
      config.accountKey,
      config.clientId,
      config.clientSecret,
      config.legacyToken ?? '',
    ]),
  );

/** Credentials only enter encrypted application variables; OAuth never starts an import. */
export class RdOAuthService {
  constructor(
    private store: Pick<typeof kv, 'get' | 'set' | 'delete'> = kv,
    private metadata = new MetadataApiClient(),
    private oauth = new RdOAuthClient(),
    private readConfig = () => process.env.RD_CREDENTIALS,
    private callbackUrl = rdCallbackUrl(),
    private now = Date.now,
    private random = () => randomBytes(32).toString('hex'),
    private readLatestFingerprint = async (): Promise<string> => {
      const result = await new RestApiClient({ runAs: 'application' }).post<{
        fingerprint: string;
      }>('/s/rd-oauth', { action: 'fingerprint' });
      if (!/^[a-f0-9]{64}$/.test(result?.fingerprint ?? ''))
        throw new Error('RD_OAUTH_CONFIG_CHECK_FAILED');
      return result.fingerprint;
    },
  ) {}

  private async authorize() {
    // The initiating member must have APPLICATIONS. Public callbacks do not call this.
    await this.metadata.query({
      findOneApplication: {
        __args: { universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER },
        id: true,
        applicationVariables: { key: true },
      },
    });
  }

  async status(): Promise<RdOAuthStatus> {
    await this.authorize();
    let config: RdOAuthConfig | null = null;
    try {
      config = parseRdOAuthConfig(this.readConfig());
    } catch {
      /* Not configured. */
    }
    let credentials: ReturnType<typeof parseCredentials> | null = null;
    try {
      credentials = parseCredentials(this.readConfig());
    } catch {
      /* Not connected. */
    }
    return {
      callbackUrl: this.callbackUrl,
      configured: Boolean(config),
      connected: Boolean(credentials),
      version: credentials?.version ?? config?.version ?? null,
      accountKey: config?.accountKey ?? credentials?.accountKey ?? '',
      clientId: config?.clientId ?? '',
    };
  }

  async start() {
    await this.authorize();
    const config = parseRdOAuthConfig(this.readConfig());
    const layouts = await this.metadata.query({
      getPageLayouts: { id: true, universalIdentifier: true },
    });
    const page = layouts.getPageLayouts.find(
      (layout) => layout.universalIdentifier === IMPORT_LAYOUT,
    );
    if (!page) throw new Error('RD_OAUTH_IMPORT_PAGE_REQUIRED');
    const previous = await this.store.get<string>(activeKey);
    if (
      typeof previous === 'string' &&
      /^rd:oauth:state:[a-f0-9]{64}$/.test(previous)
    )
      await this.store.delete(previous);
    const state = this.random();
    if (!/^[a-f0-9]{64}$/.test(state))
      throw new Error('RD_OAUTH_STATE_GENERATION_FAILED');
    const key = `rd:oauth:state:${digest(state)}`;
    await this.store.set<RdOAuthPending>(key, {
      expiresAt: this.now() + 10 * 60_000,
      fingerprint: fingerprint(config),
      returnPath: `/page/${page.id}`,
      callbackUrl: this.callbackUrl,
    });
    await this.store.set(activeKey, key);
    const url = new URL('https://accounts.rdstation.com/oauth/authorize');
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: this.callbackUrl,
      state,
    }).toString();
    return { authorizationUrl: url.href, callbackUrl: this.callbackUrl };
  }

  async configurationFingerprint(): Promise<{ fingerprint: string }> {
    await this.authorize();
    // A fresh invocation receives current decrypted server configuration. Never return it.
    return { fingerprint: fingerprint(parseRdOAuthConfig(this.readConfig())) };
  }

  private async unchangedConfig(expected: string) {
    // GraphQL variable values are deliberately masked, even for the app itself.
    // Secrets must come from the server-injected snapshot, never display metadata.
    const config = parseRdOAuthConfig(this.readConfig());
    if (
      fingerprint(config) !== expected ||
      (await this.readLatestFingerprint()) !== expected
    )
      throw new Error('RD_OAUTH_CONFIG_CHANGED');
    return config;
  }

  async complete(query: Record<string, string | undefined>): Promise<string> {
    if (!/^[a-f0-9]{64}$/.test(query.state ?? ''))
      throw new Error('RD_OAUTH_INVALID_STATE');
    const key = `rd:oauth:state:${digest(query.state!)}`;
    if ((await this.store.get(activeKey)) !== key)
      throw new Error('RD_OAUTH_INVALID_STATE');
    const pending = await this.store.get<RdOAuthPending>(key);
    if (
      !pending ||
      pending.expiresAt <= this.now() ||
      pending.callbackUrl !== this.callbackUrl ||
      !/^\/page\/[0-9a-f-]{36}$/.test(pending.returnPath)
    )
      throw new Error('RD_OAUTH_INVALID_STATE');
    const config = await this.unchangedConfig(pending.fingerprint);
    // DELETE's boolean result is an atomic claim: concurrent callbacks cannot both exchange a code.
    if (!(await this.store.delete(key)))
      throw new Error('RD_OAUTH_INVALID_STATE');
    if (query.error) throw new Error('RD_OAUTH_AUTHORIZATION_DENIED');
    if (
      !query.code ||
      query.code.length > 4096 ||
      /[\u0000-\u0020]/.test(query.code)
    )
      throw new Error('RD_OAUTH_INVALID_CODE');
    const tokens = await this.oauth.exchange(
      config.clientId,
      config.clientSecret,
      query.code,
      pending.callbackUrl,
    );
    const latest = await this.unchangedConfig(pending.fingerprint);
    if (
      (await this.store.get(activeKey)) !== key ||
      fingerprint(latest) !== pending.fingerprint
    )
      throw new Error('RD_OAUTH_CONFIG_CHANGED');
    await this.metadata.mutation({
      updateOneApplicationVariable: {
        __args: {
          key: 'RD_CREDENTIALS',
          value: JSON.stringify({
            ...latest,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
          }),
        },
      },
    });
    return pending.returnPath;
  }
}
