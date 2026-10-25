import { RECENT_SAMPLE_LIMIT } from 'src/constants/recent-sample-limit';
import { ImportOwnerPanel } from './import-owner-panel';
import { useState } from 'react';
import { Checkbox } from 'twenty-ui/primitives/input';
import { Progress } from 'twenty-ui/primitives/feedback';
import { Tag } from 'twenty-ui/primitives/data-display';
import {
  IconStack2,
  IconRefresh,
  IconClock,
  IconDownload,
  IconCheck,
  IconShield,
  IconPlayerPause,
  IconPlayerPlay,
  IconAlertTriangle,
  IconArrowRight,
  IconPlug,
  IconTrash,
} from 'twenty-ui/icon';
import type { ImportMonitorSnapshot } from 'src/types/import-monitor-snapshot';
import { importDashboard } from '../utils/import-dashboard.util';
import { importDiagnostic } from '../utils/import-diagnostic.util';
import { importDuration } from '../utils/import-duration.util';
import { ImportButton } from './import-button';
import { ImportStatusTag } from './import-status-tag';
import { ImportResourceTable } from './import-resource-table';
import { ImportActivityPanel } from './import-activity-panel';

export const ImportOverview = ({
  monitor,
  now,
  connected,
  onAction,
  onConfigure,
  onRecords,
}: {
  monitor: ImportMonitorSnapshot;
  now: number;
  connected: boolean;
  onAction: (
    action: NonNullable<ImportMonitorSnapshot['pendingAction']>,
  ) => void;
  onConfigure: () => void;
  onRecords: () => void;
}) => {
  const [acknowledged, setAcknowledged] = useState(false);
  const state = monitor.state;
  const model = importDashboard(state, now);
  const diagnostic = importDiagnostic(state);
  const running = state?.status === 'RUNNING' || state?.status === 'READY';
  const pending = Boolean(monitor.pendingAction);
  const sample = state?.selection?.scope === 'sample';
  const full = state?.selection?.scope === 'all';
  const number = (value: number | undefined) =>
    (value ?? 0).toLocaleString('pt-BR');
  const metrics = [
    {
      title:
        state?.dryRun === false
          ? 'Registros processados'
          : 'Registros verificados',
      value: number(state?.processed),
      note:
        state?.dryRun === false
          ? 'Criados + preservados'
          : 'Leitura e validação dos dados',
      Icon: IconStack2,
    },
    {
      title: 'Requisições ao RD',
      value: number(state?.requests),
      note: 'Contador do processamento',
      Icon: IconRefresh,
    },
    {
      title:
        sample && state?.preview ? 'Registros da amostra' : 'Criados no Twenty',
      value: number(
        sample && state?.preview
          ? state.preview.status === 'REMOVED'
            ? 0
            : state.preview.owned
          : state?.created,
      ),
      note:
        sample && state?.preview
          ? state.preview.status === 'REMOVED'
            ? 'Dados operacionais enviados à lixeira'
            : 'Rastreamento de exclusão; inclui vínculos'
          : state?.dryRun === false
            ? 'Registros criados nesta migração'
            : 'Simulação não cria dados de negócio',
      Icon: IconCheck,
    },
    {
      title: 'Tempo decorrido',
      value: state ? importDuration(model.elapsedSeconds) : '—',
      note:
        state && ['PAUSED', 'FAILED', 'COMPLETED'].includes(state.status)
          ? 'Até o último checkpoint salvo'
          : 'Desde o início, incluindo pausas',
      Icon: IconClock,
    },
  ];
  return (
    <>
      <section
        className="ri-card"
        style={{ marginTop: 24 }}
        aria-label="Teste recente e importação completa"
      >
        <div className="ri-card-header">
          <h2>Teste primeiro. Importe toda a base depois.</h2>
          <Tag color={full ? 'blue' : 'orange'}>
            {full
              ? 'Importação completa'
              : `Próxima amostra: até ${RECENT_SAMPLE_LIMIT} negociações`}
          </Tag>
        </div>
        <p className="ri-muted">
          O teste verifica as negociações mais recentes e seus vínculos. Depois
          você pode criar essa amostra no Twenty para conferir o resultado, sem
          percorrer toda a base. A importação completa lê todos os dados
          disponíveis pela API, do mais recente ao mais antigo, preservando os
          registros existentes.
        </p>
        <div className="ri-row" style={{ marginTop: 16, flexWrap: 'wrap' }}>
          <ImportButton
            disabled={
              pending ||
              running ||
              !connected ||
              (state?.dryRun === false && !sample)
            }
            startIcon={<IconPlayerPlay size={15} />}
            onClick={() => onAction('simulate')}
          >
            Simular dados recentes
          </ImportButton>
          <ImportButton
            emphasis
            disabled={
              pending ||
              !connected ||
              !sample ||
              !state?.dryRun ||
              state.status !== 'COMPLETED'
            }
            startIcon={<IconDownload size={15} />}
            onClick={() => onAction('sample')}
          >
            Criar amostra no Twenty
          </ImportButton>
          {state?.preview && (
            <ImportButton
              disabled={
                pending ||
                running ||
                !sample ||
                state.preview.status === 'PROMOTED' ||
                (state.preview.status === 'REMOVED' &&
                  Boolean(state.preview.viewsChecked))
              }
              startIcon={<IconTrash size={15} />}
              onClick={() => onAction('cleanup')}
            >
              {state.preview.status === 'REMOVED'
                ? state.preview.viewsChecked
                  ? 'Amostra excluída'
                  : 'Concluir limpeza da amostra'
                : state.preview.status === 'PROMOTED'
                  ? 'Amostra incorporada à base'
                  : 'Excluir dados da amostra'}
            </ImportButton>
          )}
        </div>
        <p className="ri-fine-print" style={{ marginTop: 12 }}>
          Cadastre os membros com o mesmo e-mail usado no RD e peça que aceitem
          o convite antes de simular. Uma nova simulação pode ampliar a amostra
          existente; os registros já criados são reaproveitados. A criação
          também preenche proprietários vazios quando encontra o membro,
          preservando os já definidos.
        </p>
        {state?.preview && (
          <p className="ri-fine-print" style={{ marginTop: 12 }}>
            {state.preview.owned.toLocaleString('pt-BR')} registros operacionais
            identificados neste teste ·{' '}
            {state.preview.removed.toLocaleString('pt-BR')} enviados à lixeira.
            Registros anteriores são preservados; o histórico técnico é mantido.
            Na importação completa, a amostra é reaproveitada sem duplicações.
            Visualizações dos funis removidas: {state.preview.viewsRemoved ?? 0}
            .
          </p>
        )}
        {state?.status === 'COMPLETED' && (state.dryRun || sample) && (
          <>
            <label className="ri-confirm">
              <Checkbox
                checked={acknowledged}
                onCheckedChange={(value) => setAcknowledged(Boolean(value))}
                className="ri-checkbox"
                aria-label="Conferi o backup e autorizo criar os dados no Twenty"
              />{' '}
              <span>
                Conferi o backup e o teste com a amostra. Entendo que os dados
                antigos ainda não foram verificados e quero importar toda a base
                disponível pela API.
              </span>
            </label>
            <ImportButton
              emphasis
              startIcon={<IconDownload size={15} />}
              disabled={!acknowledged || !connected || pending}
              onClick={() => onAction('start')}
            >
              Importar tudo de vez
            </ImportButton>
          </>
        )}
      </section>
      <ImportOwnerPanel owners={state?.owners} dryRun={state?.dryRun ?? true} />
      <div className="ri-metrics">
        {metrics.map(({ title, value, note, Icon }) => (
          <article className="ri-metric" key={title}>
            <div className="ri-row ri-between">
              <span className="ri-muted ri-tiny">{title}</span>
              <span className="ri-icon">
                <Icon size={15} aria-hidden />
              </span>
            </div>
            <div className="ri-metric-value ri-number">{value}</div>
            <div className="ri-muted ri-tiny">{note}</div>
          </article>
        ))}
      </div>
      <div className="ri-overview">
        <div className="ri-stack">
          <section
            className="ri-card"
            aria-label="Acompanhamento do processamento"
          >
            <div className="ri-card-header">
              <div>
                <div className="ri-eyebrow">
                  {sample
                    ? 'Teste com dados recentes'
                    : state?.dryRun === false
                      ? 'Importação em produção'
                      : 'Prévia da migração'}
                </div>
                <h2 style={{ marginTop: 6 }}>
                  {state
                    ? sample
                      ? state.dryRun
                        ? 'Simulação da amostra recente'
                        : state.preview?.status === 'REMOVED'
                          ? 'Amostra enviada à lixeira'
                          : 'Amostra criada no Twenty'
                      : state.dryRun
                        ? 'Simulação dos dados'
                        : 'Importação dos dados'
                    : 'Prepare sua primeira simulação'}
                </h2>
              </div>
              <ImportStatusTag state={state} pending={monitor.pendingAction} />
            </div>
            {monitor.loading ? (
              <div className="ri-stack" aria-label="Carregando status">
                <div className="ri-skeleton" />
                <div className="ri-skeleton" style={{ width: '65%' }} />
                <div className="ri-skeleton" style={{ height: 70 }} />
              </div>
            ) : !state ? (
              <div className="ri-empty">
                <span className="ri-empty-mark">
                  <IconDownload size={26} />
                </span>
                <h2>Seus dados, prontos para uma nova casa</h2>
                <p>
                  A simulação consulta o RD e confere os dados antes da
                  importação.
                  <br />
                  Nenhum registro de negócio será criado nesta etapa.
                </p>
                <ImportButton
                  emphasis
                  startIcon={
                    connected ? (
                      <IconPlayerPlay size={15} />
                    ) : (
                      <IconPlug size={15} />
                    )
                  }
                  disabled={pending || monitor.loading}
                  onClick={() =>
                    connected ? onAction('simulate') : onConfigure()
                  }
                >
                  {connected ? 'Iniciar simulação' : 'Conectar o RD Station'}
                </ImportButton>
              </div>
            ) : (
              <>
                <p className="ri-muted">
                  {state.status === 'PAUSED'
                    ? 'Seu progresso está salvo. Retome quando estiver pronto.'
                    : state.status === 'FAILED'
                      ? 'O processamento foi interrompido em um checkpoint seguro.'
                      : state.status === 'COMPLETED'
                        ? state.dryRun
                          ? sample
                            ? 'A amostra recente foi verificada. Isso não valida os registros antigos. Crie a amostra para conferir o resultado ou inicie a importação completa quando estiver pronto.'
                            : 'A leitura das listagens terminou. A importação real continua dependendo da sua confirmação.'
                          : 'O processamento terminou. Confira os registros criados e preservados.'
                        : model.retrySeconds
                          ? 'Aguardando o intervalo da próxima tentativa, sem avançar o checkpoint.'
                          : 'Acompanhe os tipos de dados já lidos e o checkpoint atual.'}
                </p>
                <Progress.Root
                  value={model.done}
                  max={model.total}
                  className="ri-progress"
                  aria-label="Etapas de leitura concluídas"
                >
                  <Progress.Track className="ri-progress-track">
                    <Progress.Indicator
                      className="ri-progress-fill"
                      style={{ width: `${model.percent}%` }}
                    />
                  </Progress.Track>
                </Progress.Root>
                <div className="ri-row ri-between">
                  <strong className="ri-tiny">
                    {model.done} de {model.total} etapas de leitura
                  </strong>
                  <span className="ri-muted ri-tiny">
                    {model.percent}% das etapas
                  </span>
                </div>
                <div className="ri-current">
                  <div>
                    <div className="ri-eyebrow">
                      {state.status === 'COMPLETED'
                        ? 'Resultado'
                        : 'Checkpoint atual'}
                    </div>
                    <div className="ri-current-title">{model.current}</div>
                    <span className="ri-muted ri-tiny">
                      {state.phase === 'dealDetails'
                        ? 'Relacionamentos e arquivos vinculados'
                        : state.phase === 'pipelineDetails'
                          ? 'Estrutura dos funis de vendas'
                          : 'Listagem de registros da companhia'}
                    </span>
                  </div>
                  <div>
                    <div
                      className="ri-muted ri-tiny"
                      style={{ textAlign: 'right' }}
                    >
                      Página
                    </div>
                    <div className="ri-page ri-number">{state.page}</div>
                  </div>
                </div>
                <div className="ri-facts">
                  <div className="ri-fact">
                    <span className="ri-muted ri-tiny">Último checkpoint</span>
                    <strong>
                      {state.updatedAt
                        ? new Date(state.updatedAt).toLocaleTimeString('pt-BR')
                        : '—'}
                    </strong>
                  </div>
                  {state.selection && (
                    <div className="ri-fact">
                      <span className="ri-muted ri-tiny">
                        Ordem e referência temporal
                      </span>
                      <strong>Mais recentes primeiro</strong>
                      <span className="ri-fine-print">
                        Base até{' '}
                        {new Date(state.selection.cutoff).toLocaleString(
                          'pt-BR',
                        )}
                        {state.selection.upper
                          ? ` · próxima janela até ${new Date(state.selection.upper).toLocaleString('pt-BR')}`
                          : ''}
                      </span>
                    </div>
                  )}
                  <div className="ri-fact">
                    <span className="ri-muted ri-tiny">
                      Ritmo observado nesta sessão
                    </span>
                    <strong>
                      {monitor.recordsPerMinute === null
                        ? running
                          ? 'Calculando…'
                          : 'Sem processamento ativo'
                        : `${Math.round(monitor.recordsPerMinute).toLocaleString('pt-BR')} registros/min`}
                    </strong>
                  </div>
                  <div className="ri-fact">
                    <span className="ri-muted ri-tiny">
                      Última resposta do RD
                    </span>
                    <strong>
                      {state.lastRequestDurationMs === undefined
                        ? 'Disponível nos próximos lotes'
                        : `${state.lastRequestDurationMs.toLocaleString('pt-BR')} ms`}
                    </strong>
                  </div>
                  <div className="ri-fact">
                    <span className="ri-muted ri-tiny">
                      Tentativas no checkpoint
                    </span>
                    <strong>
                      {Math.min(state.retryCount, 3)} de 3 retomadas automáticas
                    </strong>
                  </div>
                </div>
                {model.retrySeconds > 0 && (
                  <div
                    className="ri-callout"
                    role="status"
                    style={{ marginTop: 18 }}
                  >
                    <IconClock size={16} />
                    <span>
                      Próxima tentativa em{' '}
                      <strong>{importDuration(model.retrySeconds)}</strong>. A
                      página atual foi preservada.
                    </span>
                  </div>
                )}
                {state.error && (
                  <div
                    className="ri-callout ri-callout-error"
                    role="alert"
                    style={{ marginTop: 18 }}
                  >
                    <IconAlertTriangle size={17} />
                    <div>
                      <strong>{diagnostic?.title}</strong>
                      <p>{diagnostic?.description}</p>
                      <p style={{ marginTop: 8 }}>{diagnostic?.recovery}</p>
                      <details style={{ marginTop: 8 }}>
                        <summary>Ver detalhe do erro</summary>
                        <p style={{ overflowWrap: 'anywhere', marginTop: 8 }}>
                          {state.error}
                        </p>
                      </details>
                    </div>
                  </div>
                )}
                <div className="ri-safe">
                  <IconShield size={18} />
                  <span>
                    {state.dryRun
                      ? 'Modo simulação: apenas consultas GET aos dados do RD. Nenhum dado de negócio é criado no Twenty.'
                      : 'Importação de criação: registros existentes no Twenty são preservados. Os dados do RD continuam somente para leitura.'}
                  </span>
                </div>
              </>
            )}
          </section>
          <ImportResourceTable model={model} state={state} />
          {sample && (
            <section className="ri-card" aria-label="Vínculos da amostra">
              <h3>Vínculos verificados junto das negociações</h3>
              <div className="ri-facts" style={{ marginTop: 16 }}>
                <div className="ri-fact">
                  <span className="ri-muted">Empresas relacionadas</span>
                  <strong>{number(state?.counts.organizations)}</strong>
                </div>
                <div className="ri-fact">
                  <span className="ri-muted">Contatos relacionados</span>
                  <strong>{number(state?.counts.contacts)}</strong>
                </div>
                <div className="ri-fact">
                  <span className="ri-muted">Tarefas da amostra</span>
                  <strong>{number(state?.counts.tasks)}</strong>
                </div>
              </div>
              <p className="ri-fine-print" style={{ marginTop: 12 }}>
                Empresas e contatos são consultados por ID para preservar as
                relações, mesmo quando foram criados antes das negociações. As
                tarefas são trazidas na criação da amostra.
              </p>
            </section>
          )}
        </div>
        <aside className="ri-stack">
          <section className="ri-card">
            <div className="ri-card-header">
              <h2>Controle da migração</h2>
              <IconDownload size={17} className="ri-muted" />
            </div>
            <div className="ri-stack" style={{ gap: 12 }}>
              <div className="ri-row ri-between">
                <span className="ri-muted">Modo atual</span>
                <Tag
                  color={state?.dryRun === false ? 'blue' : 'orange'}
                  className={`ri-tag ${state?.dryRun === false ? 'ri-tag-accent' : 'ri-tag-warning'}`}
                >
                  {sample
                    ? state?.dryRun
                      ? 'Simulação recente'
                      : 'Amostra recente'
                    : state?.dryRun === false
                      ? 'Importação completa'
                      : 'Simulação'}
                </Tag>
              </div>
              <div className="ri-row ri-between">
                <span className="ri-muted">Conexão com o RD</span>
                <span
                  style={{
                    color: connected ? 'var(--ri-green)' : 'var(--ri-muted)',
                  }}
                >
                  {connected ? 'Conectada' : 'Não autorizada'}
                </span>
              </div>
              <div className="ri-row ri-between">
                <span className="ri-muted">Fila de execução</span>
                <span>
                  {state?.status === 'PAUSED'
                    ? 'Pausada'
                    : state?.queue?.state === 'ACTIVE'
                      ? 'Executando'
                      : state?.queue?.state === 'DELAYED'
                        ? 'Aguardando intervalo'
                        : running
                          ? 'Aguardando execução'
                          : 'Sem tarefa ativa'}
                </span>
              </div>
              {state && (
                <div className="ri-row ri-between">
                  <span className="ri-muted">Preservados / simulados</span>
                  <strong className="ri-number">{number(state.skipped)}</strong>
                </div>
              )}
              {monitor.pendingAction && (
                <div className="ri-callout" role="status">
                  <IconRefresh className="ri-spin" size={16} />
                  <span>
                    {monitor.pendingAction === 'pause'
                      ? 'Pausa solicitada. O lote em execução será concluído antes da pausa.'
                      : 'Ação enviada. Aguardando confirmação do servidor…'}
                  </span>
                </div>
              )}
              {running ? (
                <ImportButton
                  disabled={pending}
                  loading={pending}
                  startIcon={<IconPlayerPause size={15} />}
                  onClick={() => onAction('pause')}
                >
                  Pausar {state?.dryRun ? 'simulação' : 'importação'}
                </ImportButton>
              ) : state && ['PAUSED', 'FAILED'].includes(state.status) ? (
                <ImportButton
                  emphasis
                  disabled={
                    pending || !connected || diagnostic?.canResume === false
                  }
                  loading={pending}
                  startIcon={<IconPlayerPlay size={15} />}
                  onClick={() => onAction('resume')}
                >
                  {diagnostic?.canResume === false
                    ? 'Leitura precisa de ajuste'
                    : `Retomar ${state.dryRun ? 'simulação' : 'importação'}`}
                </ImportButton>
              ) : !state ? (
                <ImportButton
                  emphasis
                  disabled={pending || monitor.loading}
                  onClick={() =>
                    connected ? onAction('simulate') : onConfigure()
                  }
                >
                  {connected ? 'Simular os dados' : 'Configurar conexão'}
                </ImportButton>
              ) : null}
              <ImportButton
                onClick={onRecords}
                endIcon={<IconArrowRight size={14} />}
              >
                Ver registros da migração
              </ImportButton>
            </div>
            <p className="ri-fine-print" style={{ marginTop: 16 }}>
              {running
                ? 'O processamento continua no servidor mesmo se você fechar esta página.'
                : state?.status === 'PAUSED'
                  ? 'Nenhuma nova página será consultada enquanto a migração estiver pausada.'
                  : 'A simulação não inicia a importação automaticamente.'}
            </p>
          </section>
          <ImportActivityPanel state={state} compact />
          <section className="ri-card">
            <div className="ri-row" style={{ marginBottom: 10 }}>
              <IconShield size={17} style={{ color: 'var(--ri-green)' }} />
              <h3>Origem protegida</h3>
            </div>
            <p className="ri-fine-print">
              Consultas de dados ao RD por GET. A única exceção é a autenticação
              OAuth por POST no endpoint de tokens. O painel consulta o próprio
              Twenty e não gera chamadas extras ao RD.
            </p>
            <p className="ri-fine-print" style={{ marginTop: 10 }}>
              O percentual representa etapas de leitura. Sem um total global
              informado pelo RD, não exibimos uma previsão de término.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
};
