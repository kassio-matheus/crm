import { useEffect, useState } from 'react';
import { copyToClipboard } from 'twenty-sdk/front-component';
import { Field, Input, Radio, RadioGroup } from 'twenty-ui/primitives/input';
import { Tag } from 'twenty-ui/primitives/data-display';
import {
  IconCheck,
  IconCopy,
  IconPlug,
  IconShield,
  IconLock,
  IconExternalLink,
  IconRefresh,
  IconSettings,
} from 'twenty-ui/icon';
import type { RdCredentials } from 'src/types/rd-credentials';
import type { RdOAuthStatus } from 'src/types/rd-oauth-status';
import type { ImportState } from 'src/types/import-state';
import { executeRdOAuth } from '../utils/execute-rd-oauth.util';
import { saveImportConnection } from '../utils/save-import-connection.util';
import { ImportButton } from './import-button';

export const ImportConnectionPanel = ({
  connection,
  state,
  onRefresh,
}: {
  connection: RdOAuthStatus | null;
  state: ImportState | null;
  onRefresh: () => Promise<void>;
}) => {
  const [form, setForm] = useState<RdCredentials>({
    version: 'v2',
    accountKey: '',
    clientId: '',
    clientSecret: '',
    accessToken: '',
    refreshToken: '',
    legacyToken: '',
  });
  const [editing, setEditing] = useState(false);
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [authorizationUrl, setAuthorizationUrl] = useState('');
  const running = Boolean(state && ['RUNNING', 'READY'].includes(state.status));
  useEffect(() => {
    setForm((current) => ({
      ...current,
      version: state?.version ?? connection?.version ?? current.version,
      accountKey:
        state?.accountKey ??
        (current.accountKey || connection?.accountKey || ''),
      clientId: current.clientId || connection?.clientId || '',
    }));
  }, [
    connection?.accountKey,
    connection?.clientId,
    connection?.version,
    state?.accountKey,
    state?.version,
  ]);
  const field = (
    key: keyof RdCredentials,
    label: string,
    secret = false,
    description?: string,
  ) => (
    <Field.Root className="ri-field" key={key}>
      <Field.Label>{label}</Field.Label>
      <Input
        className="ri-input"
        type={secret ? 'password' : 'text'}
        autoComplete="off"
        disabled={busy || running || Boolean(state && key === 'accountKey')}
        value={form[key] ?? ''}
        onChange={(event) => setForm({ ...form, [key]: event.target.value })}
      />
      {description && (
        <Field.Description className="ri-fine-print">
          {description}
        </Field.Description>
      )}
    </Field.Root>
  );
  const save = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await saveImportConnection(form, manual, state);
      setForm((current) => ({
        ...current,
        clientSecret: '',
        accessToken: '',
        refreshToken: '',
        legacyToken: '',
      }));
      setAuthorizationUrl('');
      setEditing(false);
      await onRefresh();
      setNotice(
        form.version === 'v2' && !manual
          ? 'Configuração salva. Gere a autorização e conclua o acesso no RD.'
          : 'Credenciais salvas no armazenamento criptografado do Twenty.',
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Não foi possível salvar a conexão.',
      );
    } finally {
      setBusy(false);
    }
  };
  const authorize = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setAuthorizationUrl((await executeRdOAuth('start')).authorizationUrl);
      setNotice(
        'Link pronto. Continue no RD Station para escolher a conta e conferir as permissões.',
      );
    } catch {
      setError(
        'Não foi possível gerar a autorização. Confira a configuração salva e tente novamente.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ri-stack">
      <section className="ri-card">
        <div className="ri-card-header">
          <div>
            <h2>Conexão com o RD Station</h2>
            <p className="ri-muted">
              Credenciais protegidas no servidor, sem tokens expostos nesta
              página.
            </p>
          </div>
          <Tag
            color={connection?.connected ? 'green' : 'orange'}
            className={`ri-tag ${connection?.connected ? 'ri-tag-success' : 'ri-tag-warning'}`}
            startIcon={<IconPlug size={13} />}
          >
            {connection?.connected ? 'Conectada' : 'Aguardando autorização'}
          </Tag>
        </div>
        <div className="ri-facts" style={{ marginTop: 0 }}>
          <div className="ri-fact">
            <span className="ri-muted ri-tiny">Empresa vinculada</span>
            <strong>
              {state?.accountKey ||
                connection?.accountKey ||
                'Ainda não configurada'}
            </strong>
          </div>
          <div className="ri-fact">
            <span className="ri-muted ri-tiny">Método de conexão</span>
            <strong>
              {connection?.version === 'v1'
                ? 'API v1 · token pessoal'
                : 'API v2 · OAuth'}
            </strong>
          </div>
        </div>
        <div className="ri-row" style={{ marginTop: 20 }}>
          <ImportButton
            disabled={busy}
            startIcon={<IconRefresh size={15} />}
            onClick={() => void onRefresh()}
          >
            Verificar conexão
          </ImportButton>
          <ImportButton
            disabled={busy || running}
            startIcon={<IconSettings size={15} />}
            onClick={() => setEditing((value) => !value)}
          >
            {editing ? 'Fechar edição' : 'Editar configuração'}
          </ImportButton>
          {connection?.configured && (
            <ImportButton
              disabled={busy || running}
              startIcon={<IconPlug size={15} />}
              onClick={() => void authorize()}
            >
              Gerar autorização
            </ImportButton>
          )}
          {authorizationUrl && (
            <ImportButton
              emphasis
              href={authorizationUrl}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<IconExternalLink size={15} />}
            >
              Autorizar no RD Station
            </ImportButton>
          )}
        </div>
        {running && (
          <p className="ri-fine-print" style={{ marginTop: 12 }}>
            Pause o processamento para alterar a configuração. A consulta do
            status continua disponível.
          </p>
        )}
        {(editing || (!connection?.configured && !connection?.connected)) && (
          <div
            className="ri-stack"
            style={{
              marginTop: 24,
              paddingTop: 20,
              borderTop: '1px solid var(--ri-line)',
            }}
          >
            <div>
              <h3>Dados do aplicativo</h3>
              <p className="ri-fine-print">
                Use um aplicativo do produto RD Station CRM. Salvar uma
                configuração OAuth exige uma nova autorização.
              </p>
            </div>
            <RadioGroup
              value={form.version}
              onValueChange={(value) =>
                setForm({ ...form, version: value as 'v1' | 'v2' })
              }
              disabled={Boolean(state) || busy || running}
              aria-label="Versão da API"
              className="ri-row"
              style={{ gap: 20 }}
            >
              <label className="ri-row">
                <Radio value="v2" />
                API v2 · OAuth
              </label>
              <label className="ri-row">
                <Radio value="v1" />
                API v1 · token pessoal
              </label>
            </RadioGroup>
            <div className="ri-form">
              {field(
                'accountKey',
                'Identificador da empresa',
                false,
                'Letras minúsculas, números e hífens. Fica fixo após a primeira simulação.',
              )}
              {form.version === 'v2' && (
                <>
                  {field('clientId', 'Client ID')}
                  {field('clientSecret', 'Client secret', true)}
                  {field(
                    'legacyToken',
                    'Token v1 para histórico (opcional)',
                    true,
                    'Usado para anotações e histórico antigo da mesma empresa.',
                  )}
                </>
              )}
              {(form.version === 'v1' || manual) &&
                field('accessToken', 'Token de acesso', true)}
              {form.version === 'v2' &&
                manual &&
                field('refreshToken', 'Refresh token', true)}
            </div>
            <div className="ri-row">
              <ImportButton
                emphasis
                disabled={busy || running}
                loading={busy}
                startIcon={<IconLock size={15} />}
                onClick={() => void save()}
              >
                Salvar configuração
              </ImportButton>
              {form.version === 'v2' && (
                <ImportButton
                  disabled={busy || running}
                  aria-pressed={manual}
                  onClick={() => setManual((value) => !value)}
                >
                  {manual
                    ? 'Usar autorização automática'
                    : 'Tokens manuais (avançado)'}
                </ImportButton>
              )}
            </div>
          </div>
        )}
        {error && (
          <div
            className="ri-callout ri-callout-error"
            role="alert"
            style={{ marginTop: 18 }}
          >
            {error}
          </div>
        )}
        {notice && (
          <div className="ri-callout" role="status" style={{ marginTop: 18 }}>
            <IconCheck size={16} />
            <span>{notice}</span>
          </div>
        )}
      </section>
      <section className="ri-card">
        <div className="ri-card-header">
          <div>
            <h2>Callback OAuth</h2>
            <p className="ri-muted">
              Cadastre esta URL exatamente como aparece no aplicativo do RD.
            </p>
          </div>
          <IconPlug size={18} className="ri-muted" />
        </div>
        <div
          className="ri-row"
          style={{ flexWrap: 'nowrap', alignItems: 'start' }}
        >
          <Input
            className="ri-input"
            aria-label="URL de callback OAuth"
            readOnly
            value={connection?.callbackUrl ?? ''}
            style={{ flex: 1, minWidth: 0 }}
          />
          <ImportButton
            aria-label="Copiar URL de callback"
            disabled={!connection?.callbackUrl}
            startIcon={<IconCopy size={14} />}
            onClick={() => {
              void copyToClipboard(connection?.callbackUrl ?? '')
                .then(() => setNotice('URL de callback copiada.'))
                .catch(() =>
                  setError(
                    'Não foi possível copiar. Selecione o endereço e copie manualmente.',
                  ),
                );
            }}
          >
            Copiar
          </ImportButton>
        </div>
        <p className="ri-fine-print" style={{ marginTop: 12 }}>
          Conectar o aplicativo não inicia a simulação nem a importação. Uma
          nova autorização invalida links anteriores ainda não utilizados.
        </p>
      </section>
      <section className="ri-card">
        <div className="ri-row" style={{ marginBottom: 12 }}>
          <IconShield size={18} style={{ color: 'var(--ri-green)' }} />
          <h2>O que esta migração contempla</h2>
        </div>
        <p className="ri-muted">
          Funis, etapas, usuários, equipes, empresas, contatos, negociações,
          tarefas e cadastros auxiliares expostos pela API. A API v2 também
          permite trazer reuniões, propostas e arquivos de até 50 MB. Anotações
          e histórico antigo dependem do token v1 da mesma empresa.
        </p>
        <p className="ri-fine-print" style={{ marginTop: 12 }}>
          E-mails, permissões de acesso e recursos não expostos pela API
          precisam de tratamento separado. A simulação valida listagens e
          projeções; os detalhes vinculados e anexos são processados na
          importação real.
        </p>
      </section>
    </div>
  );
};
