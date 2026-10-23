import { useCallback, useEffect, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { navigate, AppPath } from 'twenty-sdk/front-component';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { Button, Input } from 'twenty-ui/primitives/input';
import { IconDownload, IconPlayerPause, IconRefresh } from 'twenty-ui/icon';
import { useTheme } from 'twenty-ui/theme';
import { IMPORT_COMPONENT } from 'src/constants/rd-identifiers';
import { executeImport } from 'src/front-components/utils/execute-import.util';
import type { ImportState } from 'src/types/import-state';
import type { RdCredentials } from 'src/types/rd-credentials';

const ImportPage = () => {
  const theme = useTheme();
  const [credentials, setCredentials] = useState<RdCredentials>({
    version: 'v2',
    accountKey: '',
    accessToken: '',
    clientId: '',
    clientSecret: '',
    refreshToken: '',
    legacyToken: '',
  });
  const [state, setState] = useState<ImportState | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [saved, setSaved] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const next = await executeImport('status');
      setState(next);
      if (next) {
        setSaved(true);
        setCredentials((c) => ({
          ...c,
          version: next.version,
          accountKey: next.accountKey,
        }));
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Falha ao consultar a importação.',
      );
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (state?.status !== 'RUNNING' && state?.status !== 'READY') return;
    const timer = setInterval(() => {
      void refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, [refresh, state?.status]);
  const action = async (name: 'simulate' | 'start' | 'pause' | 'resume') => {
    setBusy(true);
    setError('');
    try {
      setState(await executeImport(name));
      setMessage(
        name === 'pause'
          ? 'Pausa solicitada. O lote em execução será concluído com segurança.'
          : 'Solicitação enviada. O progresso será atualizado automaticamente.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao iniciar importação.');
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      if (
        !/^[a-z0-9][a-z0-9-]{2,79}$/.test(credentials.accountKey) ||
        !credentials.accessToken.trim()
      )
        throw new Error(
          'Informe uma chave estável para a empresa (letras minúsculas e hífens) e o token.',
        );
      if (
        credentials.version === 'v2' &&
        (!credentials.clientId ||
          !credentials.clientSecret ||
          !credentials.refreshToken)
      )
        throw new Error(
          'Preencha as credenciais OAuth para permitir a renovação do token.',
        );
      if (
        state &&
        (state.accountKey !== credentials.accountKey ||
          state.version !== credentials.version)
      )
        throw new Error(
          'Mantenha a mesma empresa e versão da importação existente.',
        );
      await new MetadataApiClient().mutation({
        updateOneApplicationVariable: {
          __args: { key: 'RD_CREDENTIALS', value: JSON.stringify(credentials) },
        },
      });
      setCredentials({
        ...credentials,
        accessToken: '',
        clientSecret: '',
        refreshToken: '',
        legacyToken: '',
      });
      setSaved(true);
      setMessage(
        'Credenciais salvas no armazenamento criptografado do Twenty.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar credenciais.');
    } finally {
      setBusy(false);
    }
  };
  const running = state?.status === 'RUNNING' || state?.status === 'READY';
  const statusLabel = {
    READY: 'Na fila',
    RUNNING: 'Processando',
    PAUSED: 'Pausada',
    FAILED: 'Interrompida com erro',
    COMPLETED: state?.dryRun ? 'Simulação concluída' : 'Importação concluída',
  };
  return (
    <main
      style={{
        padding: 28,
        maxWidth: 1120,
        margin: '0 auto',
        color: theme.font.color.primary,
        display: 'grid',
        gap: 24,
      }}
    >
      <header>
        <h1 style={{ margin: 0 }}>Importar do RD Station</h1>
        <p style={{ color: theme.font.color.secondary }}>
          Traga os dados da sua empresa e continue trabalhando no Twenty.
        </p>
      </header>
      {error && (
        <div
          role="alert"
          style={{ padding: 16, border: '1px solid #d94b4b', borderRadius: 8 }}
        >
          {error}
        </div>
      )}
      {message && <div role="status">{message}</div>}
      <section
        style={{
          border: `1px solid ${theme.border.color.medium}`,
          borderRadius: 12,
          padding: 24,
        }}
      >
        <h2 style={{ marginTop: 0 }}>1. Conectar sua empresa</h2>
        <p>
          Use credenciais do <strong>RD Station CRM</strong>, com acesso de
          administrador a todos os registros da empresa.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
          }}
        >
          <label>
            Versão da API
            <select
              aria-label="Versão da API"
              disabled={Boolean(state) || busy}
              value={credentials.version}
              onChange={(e) =>
                setCredentials({
                  ...credentials,
                  version: e.target.value as 'v1' | 'v2',
                })
              }
              style={{ display: 'block', width: '100%', padding: 10 }}
            >
              <option value="v2">API v2 — OAuth (recomendada)</option>
              <option value="v1">API v1 — token pessoal</option>
            </select>
          </label>
          <label>
            Identificador estável da empresa
            <Input
              aria-label="Identificador da empresa"
              placeholder="minha-empresa"
              disabled={busy || running}
              value={credentials.accountKey}
              onChange={(e) =>
                setCredentials({ ...credentials, accountKey: e.target.value })
              }
            />
          </label>
          <label>
            Token de acesso
            <Input
              aria-label="Token de acesso"
              type="password"
              autoComplete="off"
              disabled={busy || running}
              value={credentials.accessToken}
              onChange={(e) =>
                setCredentials({ ...credentials, accessToken: e.target.value })
              }
            />
          </label>
          {credentials.version === 'v2' && (
            <>
              <label>
                Client ID
                <Input
                  aria-label="Client ID"
                  autoComplete="off"
                  disabled={busy || running}
                  value={credentials.clientId}
                  onChange={(e) =>
                    setCredentials({ ...credentials, clientId: e.target.value })
                  }
                />
              </label>
              <label>
                Client secret
                <Input
                  aria-label="Client secret"
                  type="password"
                  autoComplete="off"
                  disabled={busy || running}
                  value={credentials.clientSecret}
                  onChange={(e) =>
                    setCredentials({
                      ...credentials,
                      clientSecret: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Refresh token
                <Input
                  aria-label="Refresh token"
                  type="password"
                  autoComplete="off"
                  disabled={busy || running}
                  value={credentials.refreshToken}
                  onChange={(e) =>
                    setCredentials({
                      ...credentials,
                      refreshToken: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Token da API v1 para histórico (opcional)
                <Input
                  aria-label="Token v1 para histórico"
                  type="password"
                  autoComplete="off"
                  disabled={busy || running}
                  value={credentials.legacyToken ?? ''}
                  onChange={(e) =>
                    setCredentials({
                      ...credentials,
                      legacyToken: e.target.value,
                    })
                  }
                />
              </label>
            </>
          )}
        </div>
        <p style={{ color: theme.font.color.secondary }}>
          As credenciais ficam criptografadas no servidor e não são armazenadas
          no navegador. Requer permissão de administrar aplicativos.
        </p>
        <Button disabled={busy || running} onClick={() => void save()}>
          Salvar credenciais
        </Button>
      </section>
      <section
        style={{
          border: `1px solid ${theme.border.color.medium}`,
          borderRadius: 12,
          padding: 24,
        }}
      >
        <h2 style={{ marginTop: 0 }}>2. Conferir e importar</h2>
        <p>
          Importação de criação: os registros existentes e as alterações feitas
          no Twenty são preservados. A simulação percorre e valida as listagens
          antes de criar os registros de negócio.
        </p>
        <p>
          Funis, etapas, usuários, empresas, contatos, negociações, tarefas e
          dados auxiliares são preservados. Para trazer anotações e histórico
          antigo junto com a API v2, informe também o token v1 da mesma empresa.
          A API v2 preserva também reuniões, propostas e arquivos de até 50 MB.
          E-mails, permissões de acesso e recursos não expostos pela API
          precisam de tratamento separado.
        </p>
        {credentials.version === 'v1' && (
          <p role="note">
            A API v1 pode limitar listagens a 10 mil registros. Se o teto for
            atingido, a importação para com erro; nunca informa conclusão de uma
            listagem possivelmente incompleta.
          </p>
        )}
        <label
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'start',
            marginBottom: 20,
          }}
        >
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
          />
          Conferi o backup e o acesso da empresa. Entendo o escopo da API e
          quero criar os dados no Twenty após a simulação.
        </label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button
            disabled={
              !saved || busy || running || Boolean(state && !state.dryRun)
            }
            onClick={() => void action('simulate')}
          >
            Simular importação
          </Button>
          <Button
            startIcon={<IconDownload size={16} />}
            disabled={
              busy ||
              !acknowledged ||
              state?.status !== 'COMPLETED' ||
              !state.dryRun
            }
            onClick={() => void action('start')}
          >
            Iniciar importação
          </Button>
          <Button
            startIcon={<IconPlayerPause size={16} />}
            disabled={busy || !running}
            onClick={() => void action('pause')}
          >
            Pausar
          </Button>
          <Button
            disabled={
              busy || !state || !['FAILED', 'PAUSED'].includes(state.status)
            }
            onClick={() => void action('resume')}
          >
            Retomar do checkpoint
          </Button>
          <Button
            startIcon={<IconRefresh size={16} />}
            disabled={busy}
            onClick={() => void refresh()}
          >
            Atualizar
          </Button>
        </div>
      </section>
      {state && (
        <section
          aria-live="polite"
          style={{
            padding: 24,
            background: theme.background.secondary,
            borderRadius: 12,
          }}
        >
          <h2 style={{ marginTop: 0 }}>{statusLabel[state.status]}</h2>
          <p>
            {state.dryRun ? 'Simulação' : 'Importação'} · {state.processed}{' '}
            registros processados · {state.requests} requisições
          </p>
          <p>
            {state.created} criados · {state.skipped} preservados ou simulados ·
            Página {state.page}
          </p>
          {state.error && <p role="alert">{state.error}</p>}
          <table style={{ width: '100%', textAlign: 'left' }}>
            <thead>
              <tr>
                <th>Tipo de registro</th>
                <th>Processados</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(state.counts).map(([kind, count]) => (
                <tr key={kind}>
                  <td>{kind}</td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ color: theme.font.color.secondary }}>
            O processamento continua em segundo plano, mesmo se você fechar esta
            página.
          </p>
        </section>
      )}
      <Button
        onClick={() =>
          void navigate(
            AppPath.RecordIndexPage,
            { objectNamePlural: 'rdSourceRecords' },
            {},
            { surface: 'main' },
          )
        }
      >
        Ver registros da importação
      </Button>
    </main>
  );
};

export default defineFrontComponent({
  universalIdentifier: IMPORT_COMPONENT,
  name: 'rd-import-page',
  description: 'RD Station CRM migration setup, simulation and progress.',
  component: ImportPage,
});
