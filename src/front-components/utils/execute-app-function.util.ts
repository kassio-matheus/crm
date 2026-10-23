import { RestApiClient } from 'twenty-client-sdk/rest';
import {
  IMPORT_CONTROL,
  SALES_PRIORITIES,
  OAUTH_CONTROL,
} from 'src/constants/rd-identifiers';

/** Authenticated app routes avoid requiring access to the workspace's function-management API. */
export const executeAppFunction = async (
  identifier: string,
  payload: Record<string, unknown>,
): Promise<unknown> => {
  const path =
    identifier === IMPORT_CONTROL
      ? '/s/rd-import'
      : identifier === SALES_PRIORITIES
        ? '/s/sales-priorities'
        : identifier === OAUTH_CONTROL
          ? '/s/rd-oauth'
          : null;
  if (!path) throw new Error('Ação desconhecida.');
  try {
    return await new RestApiClient().post(path, payload);
  } catch {
    throw new Error(
      'Não foi possível executar a ação. Verifique as permissões e a configuração do aplicativo no Twenty.',
    );
  }
};
