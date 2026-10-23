export type RdOAuthConfig = {
  version: 'v2';
  accountKey: string;
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  legacyToken?: string;
};
