import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Input } from 'twenty-ui/primitives/input';
import { useTheme } from 'twenty-ui/theme';
import { openSidePanelPage, SidePanelPages } from 'twenty-sdk/front-component';
import { Picker } from 'src/front-components/components/picker';
import type { SalesDeal } from 'src/types/sales-deal';
import type { SalesRepository } from 'src/front-components/utils/sales-repository';

export const DealDetail = ({
  deal,
  stages,
  members,
  busy,
  repository,
  onUpdate,
  onRefresh,
}: {
  deal: SalesDeal;
  stages: { id: string; name: string }[];
  members: { id: string; name: string }[];
  busy: boolean;
  repository: SalesRepository;
  onUpdate: (data: Parameters<SalesRepository['update']>[1]) => Promise<void>;
  onRefresh: () => Promise<void>;
}) => {
  const theme = useTheme();
  const [tab, setTab] = useState('history');
  const [activity, setActivity] = useState<
    Awaited<ReturnType<SalesRepository['activities']>>
  >({ tasks: [], notes: [], source: [] });
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const taskRequestId = useRef<string | null>(null);
  const noteRequestId = useRef<string | null>(null);
  const load = useCallback(async () => {
    try {
      setActivity(await repository.activities(deal));
    } catch {
      setError('Não foi possível carregar o histórico e as tarefas.');
    }
  }, [deal, repository]);
  useEffect(() => {
    void load();
  }, [load]);
  const saveTask = async () => {
    setSaving(true);
    setError('');
    try {
      taskRequestId.current ??= crypto.randomUUID();
      await repository.createTask(deal.id, title, dueAt, taskRequestId.current);
      taskRequestId.current = null;
      setTitle('');
      setDueAt('');
      await load();
      await onRefresh();
    } catch {
      setError(
        'Não foi possível salvar a tarefa. Confira o título e o prazo; tente novamente para retomar a gravação.',
      );
    } finally {
      setSaving(false);
    }
  };
  const saveNote = async () => {
    setSaving(true);
    setError('');
    try {
      noteRequestId.current ??= crypto.randomUUID();
      await repository.addNote(deal.id, note, noteRequestId.current);
      noteRequestId.current = null;
      setNote('');
      await load();
    } catch {
      setError(
        'Não foi possível salvar a anotação. Tente novamente para retomar a gravação.',
      );
    } finally {
      setSaving(false);
    }
  };
  const original = deal.rdOriginalData ?? {};
  const custom = (
    Array.isArray(original.deal_custom_fields)
      ? original.deal_custom_fields
      : []
  ) as {
    custom_field?: { label?: string; name?: string };
    custom_field_id?: string;
    value?: unknown;
  }[];
  const status =
    deal.dealStatus ?? (deal.stage === 'CUSTOMER' ? 'WON' : 'ONGOING');
  const panel = {
    padding: 20,
    background: theme.background.secondary,
    border: `1px solid ${theme.border.color.medium}`,
    borderRadius: 8,
  };
  const tasks = activity.tasks
    .filter((t) => t.status !== 'DONE')
    .sort((a, b) =>
      String(a.dueAt ?? 'z').localeCompare(String(b.dueAt ?? 'z')),
    );
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Button
          disabled={busy || status === 'WON'}
          onClick={() => void onUpdate({ dealStatus: 'WON' })}
        >
          Marcar venda
        </Button>
        <Button
          disabled={busy || status === 'LOST'}
          onClick={() => void onUpdate({ dealStatus: 'LOST' })}
        >
          Marcar perda
        </Button>
        <Button
          disabled={busy}
          onClick={() =>
            void onUpdate({
              dealStatus: status === 'PAUSED' ? 'ONGOING' : 'PAUSED',
            })
          }
        >
          {status === 'PAUSED' ? 'Retomar negociação' : 'Pausar negociação'}
        </Button>
        {['WON', 'LOST'].includes(status) && (
          <Button
            disabled={busy}
            onClick={() => void onUpdate({ dealStatus: 'ONGOING' })}
          >
            Reabrir negociação
          </Button>
        )}
        <Button
          onClick={() =>
            void openSidePanelPage({
              page: SidePanelPages.ViewRecord,
              objectNameSingular: 'opportunity',
              recordId: deal.id,
            })
          }
        >
          Abrir registro completo
        </Button>
      </div>
      <nav
        aria-label="Etapas da negociação"
        style={{ display: 'flex', gap: 6, overflowX: 'auto' }}
      >
        {stages.map((stage) => (
          <Button
            key={stage.id}
            disabled={
              busy ||
              stage.id ===
                (deal.salesPipelineKey ? deal.salesStageKey : deal.stage)
            }
            onClick={() =>
              void onUpdate(
                deal.salesPipelineKey
                  ? { salesStageKey: stage.id }
                  : {
                      stage: stage.id as
                        | 'NEW'
                        | 'SCREENING'
                        | 'MEETING'
                        | 'PROPOSAL'
                        | 'CUSTOMER',
                    },
              )
            }
          >
            {stage.name}
          </Button>
        ))}
      </nav>
      {error && <p role="alert">{error}</p>}
      <div
        style={{
          display: 'flex',
          gap: 24,
          flexWrap: 'wrap',
          alignItems: 'flex-start',
        }}
      >
        <aside
          style={{
            ...panel,
            flex: '1 1 280px',
            maxWidth: 440,
            display: 'grid',
            gap: 16,
          }}
        >
          <h2 style={{ margin: 0 }}>Negociação</h2>
          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              margin: 0,
            }}
          >
            <dt>Nome</dt>
            <dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{deal.name}</dd>
            <dt>Qualificação</dt>
            <dd style={{ margin: 0 }}>★ {deal.qualification ?? 0}</dd>
            <dt>Criada em</dt>
            <dd style={{ margin: 0 }}>
              {new Date(deal.rdCreatedAt ?? deal.createdAt).toLocaleString(
                'pt-BR',
              )}
            </dd>
            <dt>Previsão de fechamento</dt>
            <dd style={{ margin: 0 }}>
              {deal.closeDate
                ? new Date(deal.closeDate).toLocaleDateString('pt-BR', {
                    timeZone: 'UTC',
                  })
                : 'Não informada'}
            </dd>
            <dt>Valor total</dt>
            <dd style={{ margin: 0 }}>
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: deal.amount?.currencyCode || 'BRL',
              }).format(Number(deal.amount?.amountMicros ?? 0) / 1_000_000)}
            </dd>
          </dl>
          <h3>Responsável</h3>
          {deal.rdOwnerName && !deal.ownerId && (
            <p>{deal.rdOwnerName} · responsável original no RD Station</p>
          )}
          <Picker
            label="Responsável da negociação"
            value={deal.ownerId ?? ''}
            options={[
              { value: '', label: 'Sem responsável no Twenty' },
              ...members.map((m) => ({ value: m.id, label: m.name })),
            ]}
            disabled={busy}
            onChange={(id) => void onUpdate({ ownerId: id || null })}
          />
          <h3>Contato</h3>
          <p style={{ margin: 0 }}>
            {deal.pointOfContact
              ? `${deal.pointOfContact.name?.firstName ?? ''} ${deal.pointOfContact.name?.lastName ?? ''}`
              : 'Sem contato principal'}
          </p>
          {deal.pointOfContact?.phones?.primaryPhoneNumber && (
            <span>{deal.pointOfContact.phones.primaryPhoneNumber}</span>
          )}
          {deal.pointOfContact?.emails?.primaryEmail && (
            <span>{deal.pointOfContact.emails.primaryEmail}</span>
          )}
          <h3>Empresa</h3>
          <p style={{ margin: 0 }}>
            {deal.company?.name ?? 'Sem empresa vinculada'}
          </p>
          {custom.length > 0 && (
            <>
              <h3>Informações adicionais</h3>
              <dl>
                {custom.map((field, index) => (
                  <div
                    key={field.custom_field_id ?? index}
                    style={{ marginBottom: 12 }}
                  >
                    <dt>
                      {field.custom_field?.label ??
                        field.custom_field?.name ??
                        'Campo personalizado'}
                    </dt>
                    <dd style={{ margin: '4px 0', overflowWrap: 'anywhere' }}>
                      {typeof field.value === 'string'
                        ? field.value
                        : JSON.stringify(field.value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          )}
          {Boolean(original.custom_fields) && (
            <>
              <h3>Campos personalizados</h3>
              <dl>
                {Object.entries(
                  original.custom_fields as Record<string, unknown>,
                ).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>
                      {typeof value === 'string'
                        ? value
                        : JSON.stringify(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </aside>
        <section
          style={{ flex: '3 1 420px', minWidth: 0, display: 'grid', gap: 18 }}
        >
          <h2 style={{ margin: 0 }}>Próximas tarefas</h2>
          {tasks.length ? (
            tasks.map((task) => (
              <div
                key={task.id}
                style={{
                  ...panel,
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <span style={{ flex: 1 }}>
                  {task.title} ·{' '}
                  {task.dueAt
                    ? new Date(task.dueAt).toLocaleString('pt-BR')
                    : 'Sem prazo'}
                </span>
                <Button
                  disabled={saving}
                  onClick={() => {
                    setSaving(true);
                    void repository
                      .completeTask(task.id)
                      .then(async () => {
                        await load();
                        await onRefresh();
                      })
                      .catch(() =>
                        setError('Não foi possível concluir a tarefa.'),
                      )
                      .finally(() => setSaving(false));
                  }}
                >
                  Concluir
                </Button>
              </div>
            ))
          ) : (
            <div style={panel}>
              Não existem tarefas pendentes para esta negociação.
            </div>
          )}
          <div
            style={{
              ...panel,
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'end',
            }}
          >
            <label>
              Título da tarefa
              <Input
                aria-label="Título da tarefa"
                value={title}
                disabled={saving}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              Prazo
              <Input
                aria-label="Prazo da tarefa"
                type="datetime-local"
                value={dueAt}
                disabled={saving}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </label>
            <Button
              disabled={saving || !title.trim() || !dueAt}
              onClick={() => void saveTask()}
            >
              Criar tarefa
            </Button>
          </div>
          <nav
            aria-label="Conteúdo da negociação"
            style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
          >
            {[
              { id: 'history', name: 'Histórico' },
              { id: 'tasks', name: 'Tarefas' },
              { id: 'products', name: 'Produtos' },
              { id: 'files', name: 'Arquivos' },
            ].map((t) => (
              <Button
                key={t.id}
                disabled={tab === t.id}
                onClick={() => setTab(t.id)}
              >
                {t.name}
              </Button>
            ))}
          </nav>
          {tab === 'history' && (
            <>
              <label>
                Nova anotação
                <Input
                  aria-label="Nova anotação"
                  value={note}
                  disabled={saving}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <Button
                disabled={saving || !note.trim()}
                onClick={() => void saveNote()}
              >
                Criar anotação
              </Button>
              {activity.notes
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((item) => (
                  <article
                    key={item.id}
                    style={{
                      borderLeft: `3px solid ${theme.border.color.medium}`,
                      padding: '4px 18px',
                    }}
                  >
                    <strong>{item.title}</strong>
                    <p
                      style={{
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {item.text}
                    </p>
                    <small>
                      {new Date(item.createdAt).toLocaleString('pt-BR')}
                    </small>
                  </article>
                ))}
              {(Array.isArray(original.deal_stage_histories)
                ? original.deal_stage_histories
                : activity.source.flatMap((item) =>
                    item.kind === 'deal-history' &&
                    Array.isArray(item.data.deal_stage_histories)
                      ? item.data.deal_stage_histories
                      : [],
                  )
              ).map(
                (
                  item: {
                    id?: string;
                    deal_stage_id?: string;
                    start_date?: string;
                  },
                  i: number,
                ) => (
                  <article key={item.id ?? i} style={panel}>
                    Etapa:{' '}
                    {stages.find((s) => s.id === item.deal_stage_id)?.name ??
                      'Etapa do RD Station'}{' '}
                    ·{' '}
                    {item.start_date
                      ? new Date(item.start_date).toLocaleString('pt-BR')
                      : ''}
                  </article>
                ),
              )}
              <p>
                Negociação criada ·{' '}
                {new Date(deal.rdCreatedAt ?? deal.createdAt).toLocaleString(
                  'pt-BR',
                )}
              </p>
            </>
          )}
          {tab === 'tasks' &&
            activity.tasks.map((task) => (
              <div key={task.id} style={panel}>
                {task.title} ·{' '}
                {task.status === 'DONE' ? 'Concluída' : 'Pendente'}
              </div>
            ))}
          {(tab === 'products' || tab === 'files') && (
            <>
              {activity.source
                .filter((item) =>
                  tab === 'products'
                    ? item.kind === 'deal-products' ||
                      item.kind === 'deal-deal_products'
                    : item.kind === 'deal-files',
                )
                .map((item, index) => (
                  <article key={index} style={panel}>
                    <strong>
                      {String(
                        item.data.name ??
                          item.data.filename ??
                          'Item importado',
                      )}
                    </strong>
                    {tab === 'products' && (
                      <p>
                        Quantidade:{' '}
                        {String(item.data.quantity ?? item.data.amount ?? '')} ·
                        Valor:{' '}
                        {String(item.data.total ?? item.data.price ?? '')}
                      </p>
                    )}
                    {tab === 'files' && (
                      <p>
                        Arquivo copiado para o Twenty. Acesse pelo registro
                        completo da negociação.
                      </p>
                    )}
                  </article>
                ))}
              {!activity.source.some((item) =>
                tab === 'products'
                  ? item.kind.includes('products')
                  : item.kind === 'deal-files',
              ) && <p>Nenhum item disponível.</p>}
            </>
          )}
        </section>
      </div>
    </div>
  );
};
