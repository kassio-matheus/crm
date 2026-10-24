import type { ImportState } from 'src/types/import-state';
import { rdImportResources } from 'src/utils/rd-import-resources.util';

export const importDiagnostic = (state: ImportState | null) => {
  if (!state?.error) return null;
  const resource = (state.plan ?? rdImportResources(state.version))[
    state.resourceIndex
  ]?.split('?')[0];
  if (state.error.startsWith('RD_DENSE_TIMESTAMP_LIMIT'))
    return {
      title: 'Muitos registros com a mesma data',
      description:
        'A API retornou mais registros com a mesma data de criação do que permite listar nesse filtro.',
      recovery:
        'O checkpoint foi preservado. Nenhum registro foi descartado; essa faixa precisa de uma estratégia adicional de divisão antes de continuar.',
      canResume: false,
    };
  if (state.error.startsWith('RD_PREVIEW_IN_USE'))
    return {
      title: 'A amostra está sendo usada por outros registros',
      description:
        'Existem vínculos criados fora do teste que dependem destes dados.',
      recovery:
        'Revise os vínculos antes de excluir a amostra. Dados anteriores não foram incluídos na exclusão.',
      canResume: true,
    };
  if (
    state.version === 'v2' &&
    state.phase === 'resources' &&
    state.page > 400 &&
    ['organizations', 'contacts', 'deals'].includes(resource ?? '') &&
    (state.counts[resource] ?? 0) >= 10_000 &&
    state.error.startsWith('RD_HTTP_400')
  )
    return {
      title: 'Limite de listagem atingido',
      description:
        'O RD recusou a próxima página após 10.000 registros deste tipo. A API limita essas listagens a 10.000 resultados por filtro.',
      recovery:
        'A leitura precisa ser dividida em filtros menores antes de continuar. Repetir a mesma página não resolve essa interrupção. Seu checkpoint foi preservado.',
      canResume: false,
    };
  if (/RD_HTTP_(401|403)|RD_OAUTH_RECONNECT_REQUIRED/.test(state.error))
    return {
      title: 'Confira o acesso ao RD Station',
      description:
        'A autorização não permite concluir esta consulta. Confira a conta vinculada e as permissões do aplicativo.',
      recovery:
        'Abra Conexão e configuração para revisar o acesso antes de retomar.',
      canResume: true,
    };
  if (/RD_RETRY:|RD_CONNECTION_FAILED/.test(state.error))
    return {
      title: 'A comunicação com o RD foi interrompida',
      description:
        'O limite de tentativas automáticas foi atingido. O cursor atual foi preservado.',
      recovery:
        'Confira a conexão e retome quando o serviço estiver disponível.',
      canResume: true,
    };
  return {
    title: 'Precisamos revisar esta etapa',
    description:
      'O processamento parou em um checkpoint seguro, sem avançar a página com erro.',
    recovery:
      'Confira o detalhe técnico abaixo e corrija a causa antes de retomar.',
    canResume: true,
  };
};
