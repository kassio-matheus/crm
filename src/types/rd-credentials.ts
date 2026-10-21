export type RdCredentials = {
  version: 'v1' | 'v2';
  accountKey: string;
  accessToken: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
};
