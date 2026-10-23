export type RdOAuthStatus = {
  callbackUrl: string;
  configured: boolean;
  connected: boolean;
  accountKey: string;
  clientId: string;
  version: 'v1' | 'v2' | null;
};
