import { OAUTH_CONTROL } from 'src/constants/rd-identifiers';
import { executeAppFunction } from 'src/front-components/utils/execute-app-function.util';
import type { RdOAuthStatus } from 'src/types/rd-oauth-status';
import type { RdOAuthAuthorization } from 'src/types/rd-oauth-authorization';

export const executeRdOAuth = async <T extends 'status' | 'start'>(
  action: T,
): Promise<T extends 'start' ? RdOAuthAuthorization : RdOAuthStatus> =>
  (await executeAppFunction(OAUTH_CONTROL, { action })) as T extends 'start'
    ? RdOAuthAuthorization
    : RdOAuthStatus;
