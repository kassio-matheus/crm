import { defineLogicFunction } from 'twenty-sdk/define';
import { RdOAuthService } from 'src/services/rd-oauth-service';
import { OAUTH_CONTROL } from 'src/constants/rd-identifiers';

export default defineLogicFunction({
  universalIdentifier: OAUTH_CONTROL,
  name: 'rd-oauth',
  description:
    'Admin-only RD OAuth setup/status. Returns a state-bound authorization link without exposing credentials or starting any import.',
  timeoutSeconds: 60,
  httpRouteTriggerSettings: {
    path: '/rd-oauth',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
  handler: async (
    event:
      | { action: 'status' | 'start' }
      | { body: { action: 'status' | 'start' } },
  ) => {
    const payload = event && 'body' in event ? event.body : event;
    if (!payload || !['status', 'start'].includes(payload.action))
      throw new Error('Invalid OAuth action.');
    const service = new RdOAuthService();
    return payload.action === 'start' ? service.start() : service.status();
  },
});
