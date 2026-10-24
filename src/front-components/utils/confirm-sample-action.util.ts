import { openCommandConfirmationModal } from 'twenty-sdk/front-component';
import type { ImportState } from 'src/types/import-state';

export const confirmSampleAction = async (
  action: 'sample' | 'cleanup',
  state: ImportState | null,
): Promise<boolean> => {
  if (!state || state.selection?.scope !== 'sample') return false;
  if (action === 'sample' && (!state.dryRun || state.status !== 'COMPLETED'))
    return false;
  if (
    action === 'cleanup' &&
    (!state.preview ||
      ['PROMOTED', 'REMOVED'].includes(state.preview.status) ||
      ['RUNNING', 'READY'].includes(state.status))
  )
    return false;
  return (
    (await openCommandConfirmationModal(
      action === 'sample'
        ? {
            title: 'Criar a amostra recente no Twenty?',
            subtitle: `Serão criadas até ${state.selection.limit} negociações recentes, seus contatos, empresas, funis, etapas e uma amostra de até cinco tarefas por negociação. Registros existentes serão preservados. Você poderá excluir os registros criados por este teste antes de iniciar a importação completa.`,
            confirmButtonText: 'Criar amostra recente',
            confirmButtonAccent: 'blue',
          }
        : {
            title: 'Excluir somente os dados da amostra?',
            subtitle:
              'Os registros operacionais criados por este teste, incluindo alterações feitas neles, serão enviados à lixeira do Twenty. Registros que já existiam serão preservados. A exclusão será bloqueada se novos registros fora da amostra dependerem desses dados. O histórico técnico de origem será mantido. Nenhum dado será excluído no RD.',
            confirmButtonText: 'Excluir dados da amostra',
            confirmButtonAccent: 'danger',
          },
    )) === 'confirm'
  );
};
