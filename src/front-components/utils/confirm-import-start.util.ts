import { openCommandConfirmationModal } from 'twenty-sdk/front-component';
import type { ImportState } from 'src/types/import-state';

export const confirmImportStart = async (
  state: ImportState | null,
): Promise<boolean> => {
  if (
    !state ||
    state.status !== 'COMPLETED' ||
    (!state.dryRun && state.selection?.scope !== 'sample')
  )
    return false;
  return (
    (await openCommandConfirmationModal({
      title: 'Importar todos os dados disponíveis?',
      subtitle: `O teste verificou uma amostra recente. Esta ação percorre toda a base disponível pela API, começando pelas negociações mais recentes, buscando seus vínculos e avançando para os dados antigos com filtros de data. A amostra será incorporada à importação e não poderá mais ser excluída pelo botão de teste. Registros existentes são preservados. O RD continua somente para leitura.`,
      confirmButtonText: 'Importar tudo de vez',
      confirmButtonAccent: 'blue',
    })) === 'confirm'
  );
};
