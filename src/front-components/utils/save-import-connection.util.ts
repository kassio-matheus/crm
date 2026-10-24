import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import type { RdCredentials } from 'src/types/rd-credentials';
import type { ImportState } from 'src/types/import-state';

export const saveImportConnection = async (
  credentials: RdCredentials,
  manual: boolean,
  state: ImportState | null,
): Promise<void> => {
  if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(credentials.accountKey))
    throw new Error(
      'Use um identificador de empresa com letras minúsculas, números e hífens.',
    );
  if (
    state &&
    (state.accountKey !== credentials.accountKey ||
      state.version !== credentials.version)
  )
    throw new Error('Mantenha a mesma empresa e versão da migração existente.');
  if (state && ['RUNNING', 'READY'].includes(state.status))
    throw new Error('Pause o processamento antes de alterar a conexão.');
  if (credentials.version === 'v1' && !credentials.accessToken.trim())
    throw new Error('Informe o token de acesso da API v1.');
  if (
    credentials.version === 'v2' &&
    (!credentials.clientId ||
      !credentials.clientSecret ||
      (manual && (!credentials.accessToken || !credentials.refreshToken)))
  )
    throw new Error(
      'Preencha Client ID e Client secret. No modo manual, informe também os dois tokens.',
    );
  const value = {
    ...credentials,
    accessToken:
      credentials.version === 'v2' && !manual ? '' : credentials.accessToken,
    refreshToken:
      credentials.version === 'v2' && !manual ? '' : credentials.refreshToken,
  };
  try {
    await new MetadataApiClient().mutation({
      updateOneApplicationVariable: {
        __args: { key: 'RD_CREDENTIALS', value: JSON.stringify(value) },
      },
    });
  } catch {
    throw new Error(
      'Não foi possível salvar a conexão. Confira sua permissão de administrar aplicativos e tente novamente.',
    );
  }
};
