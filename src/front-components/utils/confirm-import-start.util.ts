import { openCommandConfirmationModal } from 'twenty-sdk/front-component';
import type { ImportState } from 'src/types/import-state';

export const confirmImportStart = async (
  state: ImportState | null,
): Promise<boolean> => {
  if (!state?.dryRun || state.status !== 'COMPLETED') return false;
  return (
    (await openCommandConfirmationModal({
      title: 'Iniciar importação real?',
      subtitle: `A simulação verificou ${state.processed.toLocaleString('pt-BR')} registros. Esta ação cria os dados no Twenty, preservando os registros existentes. Os dados do RD continuam somente para leitura.`,
      confirmButtonText: 'Criar os dados no Twenty',
      confirmButtonAccent: 'blue',
    })) === 'confirm'
  );
};
