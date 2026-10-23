import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, kv, type RoutePayload } from 'twenty-sdk/logic-function';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { RdOAuthService } from 'src/services/rd-oauth-service';
import { rdCallbackUrl } from 'src/utils/rd-callback-url.util';
import { OAUTH_CALLBACK } from 'src/constants/rd-identifiers';

const headers = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
};
const page = (text: string, target?: string) =>
  `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Conexão RD Station</title>${target ? `<meta http-equiv="refresh" content="0;url=${target}">` : ''}</head><body><h1>Conexão RD Station</h1><p>${text}</p>${target ? `<a href="${target}">Voltar ao CRM</a>` : ''}</body></html>`;

export default defineLogicFunction({
  universalIdentifier: OAUTH_CALLBACK,
  name: 'rd-oauth-callback',
  description:
    'Receive the RD OAuth authorization code through GET. Requires an unexpired, one-use state from an authenticated admin; saves encrypted tokens only, never imports records.',
  timeoutSeconds: 60,
  httpRouteTriggerSettings: {
    path: '/rd-station/oauth/callback',
    httpMethod: 'GET',
    isAuthRequired: false,
  },
  handler: async (event: RoutePayload) => {
    if (event.requestContext?.http?.method !== 'GET')
      return new Response(page('Método não permitido.'), {
        status: 405,
        headers,
      });
    const query = event.queryStringParameters ?? {};
    if (!query.code && !query.state && !query.error)
      return new Response(
        page(
          'Callback disponível. Inicie a autorização pela página Importar do RD Station no CRM.',
        ),
        { headers },
      );
    try {
      const callbackUrl = rdCallbackUrl();
      const path = await new RdOAuthService(
        kv,
        new MetadataApiClient({ runAs: 'application' }),
      ).complete(query);
      const target = `${new URL(callbackUrl).origin}${path}`;
      return new Response(
        page('Conexão concluída. Nenhuma importação foi iniciada.', target),
        { headers },
      );
    } catch (error) {
      // Only allowlisted static codes may enter logs; never log the query or foreign errors.
      const known = [
        'RD_OAUTH_INVALID_STATE',
        'RD_OAUTH_CONFIG_CHANGED',
        'RD_OAUTH_CONFIG_CHECK_FAILED',
        'RD_OAUTH_AUTHORIZATION_DENIED',
        'RD_OAUTH_INVALID_CODE',
        'RD_OAUTH_RECONNECT_REQUIRED',
      ];
      const reason = error instanceof Error && known.includes(error.message)
        ? error.message
        : 'RD_OAUTH_CALLBACK_FAILED';
      console.warn(reason);

      return new Response(
        page(
          'Não foi possível concluir a conexão. Retorne ao CRM e gere uma nova autorização.',
        ),
        { status: 400, headers },
      );
    }
  },
});
