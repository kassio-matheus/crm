import { useCallback, useEffect, useRef, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { navigate, AppPath } from 'twenty-sdk/front-component';
import { Tabs } from 'twenty-ui/primitives/navigation';
import { Tag } from 'twenty-ui/primitives/data-display';
import { Callout } from 'twenty-ui/components/feedback';
import {
  IconRefresh,
  IconChartBar,
  IconTimelineEvent,
  IconSettings,
  IconArrowRight,
  IconShield,
} from 'twenty-ui/icon';
import { IMPORT_COMPONENT } from 'src/constants/rd-identifiers';
import type { RdOAuthStatus } from 'src/types/rd-oauth-status';
import { executeImport } from './utils/execute-import.util';
import { executeRdOAuth } from './utils/execute-rd-oauth.util';
import { ImportMonitor } from './utils/import-monitor.util';
import { confirmImportStart } from './utils/confirm-import-start.util';
import { confirmSampleAction } from './utils/confirm-sample-action.util';
import { importDuration } from './utils/import-duration.util';
import { ImportPageStyles } from './components/import-page-styles';
import { ImportButton } from './components/import-button';
import { ImportOverview } from './components/import-overview';
import { ImportActivityPanel } from './components/import-activity-panel';
import { ImportConnectionPanel } from './components/import-connection-panel';

const ImportPage = () => {
  const [monitor, setMonitor] = useState(ImportMonitor.initial);
  const [connection, setConnection] = useState<RdOAuthStatus | null>(null);
  const [connectionError, setConnectionError] = useState('');
  const [actionError, setActionError] = useState('');
  const [tab, setTab] = useState('overview');
  const [now, setNow] = useState(Date.now);
  const service = useRef<ImportMonitor | null>(null);
  const mounted = useRef(false);
  const refreshConnection = useCallback(async () => {
    try {
      const result = await executeRdOAuth('status');
      if (mounted.current) {
        setConnection(result);
        setConnectionError('');
      }
    } catch {
      if (mounted.current)
        setConnectionError(
          'Não foi possível verificar a conexão. Confira seu acesso ao workspace e tente novamente.',
        );
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    const instance = new ImportMonitor(executeImport, setMonitor);
    service.current = instance;
    instance.start();
    void refreshConnection();
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      mounted.current = false;
      instance.stop();
      service.current = null;
      clearInterval(clock);
    };
  }, [refreshConnection]);
  const action = async (name: NonNullable<typeof monitor.pendingAction>) => {
    setActionError('');
    try {
      if (name === 'start' && !(await confirmImportStart(monitor.state)))
        return;
      if (
        (name === 'sample' || name === 'cleanup') &&
        !(await confirmSampleAction(name, monitor.state))
      )
        return;
      await service.current?.command(name);
    } catch {
      setActionError(
        'Não foi possível confirmar a ação. Confira o status e tente novamente.',
      );
    }
  };
  const onRecords = () => {
    void navigate(
      AppPath.RecordIndexPage,
      { objectNamePlural: 'rdSourceRecords' },
      {},
      { surface: 'main' },
    );
  };
  const age =
    monitor.lastSyncedAt === null
      ? null
      : Math.max(0, Math.floor((now - monitor.lastSyncedAt) / 1000));
  const stale = Boolean(monitor.failures || (age !== null && age > 30));
  return (
    <ImportPageStyles>
      <header className="ri-header">
        <div className="ri-title">
          <div className="ri-eyebrow">Integrações / RD Station CRM</div>
          <h1>Central de importação</h1>
          <p className="ri-muted">
            Cada etapa da sua migração, em um só lugar.
          </p>
        </div>
        <div
          className="ri-connector"
          aria-label="Conexão RD Station para Twenty"
        >
          <span className="ri-app ri-app-rd">RD</span>
          <IconArrowRight size={17} className="ri-muted" aria-hidden />
          <span className="ri-app">20</span>
          <Tag
            color={connection?.connected ? 'green' : 'orange'}
            className={`ri-tag ${connection?.connected ? 'ri-tag-success' : 'ri-tag-warning'}`}
          >
            <span className="ri-dot" />
            {connection?.connected ? 'Conectado' : 'Não conectado'}
          </Tag>
        </div>
      </header>
      <div className="ri-row ri-between">
        <div className="ri-row">
          <Tag
            color={stale ? 'orange' : 'green'}
            className={`ri-tag ${stale ? 'ri-tag-warning' : 'ri-tag-success'}`}
          >
            <span
              className={`ri-dot ${!stale && !monitor.loading ? 'ri-pulse' : ''}`}
            />
            {monitor.loading
              ? 'Conectando ao painel'
              : stale
                ? 'Atualização pendente'
                : 'Acompanhamento ao vivo'}
          </Tag>
          <span className="ri-muted ri-tiny" role="status">
            {monitor.refreshing
              ? 'Atualizando status…'
              : age === null
                ? 'Aguardando primeiro status'
                : age === 0
                  ? 'Atualizado agora'
                  : `Atualizado há ${importDuration(age)}`}
          </span>
        </div>
        <ImportButton
          startIcon={
            <IconRefresh
              size={14}
              className={monitor.refreshing ? 'ri-spin' : ''}
            />
          }
          disabled={monitor.refreshing}
          onClick={() => {
            void service.current?.refresh();
            void refreshConnection();
          }}
        >
          Atualizar agora
        </ImportButton>
      </div>
      {(monitor.error || connectionError || actionError) && (
        <Callout
          className="ri-callout ri-callout-error"
          status="error"
          role="alert"
          style={{ marginTop: 16 }}
          title="Precisamos da sua atenção"
          icon={<IconRefresh size={16} />}
          description={
            <>
              {monitor.error || connectionError || actionError}
              {monitor.failures > 0 && (
                <p className="ri-tiny">
                  Nova tentativa em até{' '}
                  {Math.max(
                    0,
                    Math.ceil(((monitor.nextPollAt ?? now) - now) / 1000),
                  )}
                  s. O processamento no servidor não é interrompido.
                </p>
              )}
            </>
          }
        />
      )}
      <Tabs.Root value={tab} onValueChange={(value) => setTab(String(value))}>
        <Tabs.List
          className="ri-tabs"
          aria-label="Seções da central de importação"
        >
          <Tabs.Tab
            className="ri-tab"
            value="overview"
            startIcon={<IconChartBar size={15} />}
          >
            Visão geral
          </Tabs.Tab>
          <Tabs.Tab
            className="ri-tab"
            value="activity"
            startIcon={<IconTimelineEvent size={15} />}
            badge={monitor.state?.activity?.length || undefined}
          >
            Atividade
          </Tabs.Tab>
          <Tabs.Tab
            className="ri-tab"
            value="settings"
            startIcon={<IconSettings size={15} />}
          >
            Conexão e configuração
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel className="ri-panel" value="overview">
          <ImportOverview
            monitor={monitor}
            now={now}
            connected={Boolean(connection?.connected)}
            onAction={(name) => void action(name)}
            onConfigure={() => setTab('settings')}
            onRecords={onRecords}
          />
        </Tabs.Panel>
        <Tabs.Panel className="ri-panel" value="activity">
          <ImportActivityPanel state={monitor.state} />
          <div className="ri-card" style={{ marginTop: 20 }}>
            <h2>Detalhes do processamento</h2>
            <div className="ri-facts">
              <div className="ri-fact">
                <span className="ri-muted ri-tiny">Início da migração</span>
                <strong>
                  {monitor.state?.startedAt
                    ? new Date(monitor.state.startedAt).toLocaleString('pt-BR')
                    : 'Ainda não iniciada'}
                </strong>
              </div>
              <div className="ri-fact">
                <span className="ri-muted ri-tiny">
                  Último checkpoint salvo
                </span>
                <strong>
                  {monitor.state?.updatedAt
                    ? new Date(monitor.state.updatedAt).toLocaleString('pt-BR')
                    : '—'}
                </strong>
              </div>
              <div className="ri-fact">
                <span className="ri-muted ri-tiny">
                  Registros preservados ou simulados
                </span>
                <strong>
                  {(monitor.state?.skipped ?? 0).toLocaleString('pt-BR')}
                </strong>
              </div>
              <div className="ri-fact">
                <span className="ri-muted ri-tiny">
                  Ritmo de requisições nesta sessão
                </span>
                <strong>
                  {monitor.requestsPerMinute === null
                    ? 'Disponível durante o processamento'
                    : `${Math.round(monitor.requestsPerMinute)} requisições/min`}
                </strong>
              </div>
            </div>
            <details style={{ marginTop: 20 }}>
              <summary>Informações técnicas do checkpoint</summary>
              <div className="ri-details">
                <dl>
                  <dt>Identificador da migração</dt>
                  <dd>{monitor.state?.id ?? '—'}</dd>
                  <dt>Revisão do checkpoint</dt>
                  <dd>{monitor.state?.revision ?? '—'}</dd>
                  <dt>Posição na página</dt>
                  <dd>{monitor.state?.recordOffset ?? '—'}</dd>
                  <dt>API utilizada</dt>
                  <dd>
                    {monitor.state?.version ?? connection?.version ?? '—'}
                  </dd>
                </dl>
              </div>
            </details>
          </div>
        </Tabs.Panel>
        <Tabs.Panel className="ri-panel" value="settings" keepMounted>
          <ImportConnectionPanel
            connection={connection}
            state={monitor.state}
            onRefresh={refreshConnection}
          />
        </Tabs.Panel>
      </Tabs.Root>
      <footer className="ri-footer">
        <span className="ri-row">
          <IconShield size={13} />
          Dados do RD somente para leitura · Credenciais criptografadas
        </span>
        <span>
          {monitor.state && ['RUNNING', 'READY'].includes(monitor.state.status)
            ? 'Status consultado a cada 3s'
            : 'Status consultado a cada 15s'}{' '}
          · {monitor.state?.accountKey ?? 'Configure sua empresa'}
        </span>
      </footer>
    </ImportPageStyles>
  );
};

export default defineFrontComponent({
  universalIdentifier: IMPORT_COMPONENT,
  name: 'rd-import-page',
  description:
    'Live RD migration dashboard with resource progress, durable activity, connection setup and explicit import controls.',
  component: ImportPage,
});
