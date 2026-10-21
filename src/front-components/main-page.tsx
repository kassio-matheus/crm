import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { Button, Input } from 'twenty-ui/primitives/input';
import {
  IconPlus,
  IconLayoutKanban,
  IconList,
  IconRefresh,
  IconSparkles,
  IconArrowLeft,
} from 'twenty-ui/icon';
import { useTheme } from 'twenty-ui/theme';
import { MAIN_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { SalesRepository } from 'src/front-components/utils/sales-repository';
import { Picker } from 'src/front-components/components/picker';
import { DealDetail } from 'src/front-components/components/deal-detail';
import { executeAppFunction } from 'src/front-components/utils/execute-app-function.util';
import { SALES_PRIORITIES } from 'src/constants/rd-identifiers';
import { sortDeals } from 'src/utils/sort-deals.util';
import type { SalesBoard } from 'src/types/sales-board';
import type { SalesDeal } from 'src/types/sales-deal';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Todos os status' },
  { value: 'ONGOING', label: 'Em andamento' },
  { value: 'WON', label: 'Vendido' },
  { value: 'LOST', label: 'Perdido' },
  { value: 'PAUSED', label: 'Pausado' },
  { value: 'NOT_PAUSED', label: 'Não pausado' },
];
const SORT_OPTIONS = [
  { value: 'nameAsc', label: 'Alfabética A–Z' },
  { value: 'nameDesc', label: 'Alfabética Z–A' },
  { value: 'newest', label: 'Criadas por último' },
  { value: 'oldest', label: 'Criadas primeiro' },
  { value: 'nextTask', label: 'Data da próxima tarefa' },
  { value: 'closeDate', label: 'Previsão de fechamento' },
  { value: 'lastContact', label: 'Contato mais recente' },
  { value: 'oldestContact', label: 'Contato mais antigo' },
  { value: 'rating', label: 'Mais qualificadas' },
];
const NATIVE_STAGES = [
  { id: 'NEW', name: 'Nova' },
  { id: 'SCREENING', name: 'Qualificação' },
  { id: 'MEETING', name: 'Reunião' },
  { id: 'PROPOSAL', name: 'Proposta' },
  { id: 'CUSTOMER', name: 'Cliente' },
];

const MainPage = () => {
  const theme = useTheme();
  const repository = useMemo(() => new SalesRepository(), []);
  const [board, setBoard] = useState<SalesBoard>({
    deals: [],
    pipelines: [],
    stages: [],
    members: [],
  });
  const [pipeline, setPipeline] = useState('');
  const [owner, setOwner] = useState('ALL');
  const [status, setStatus] = useState('ONGOING');
  const [sort, setSort] = useState('newest');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [minimumRating, setMinimumRating] = useState('0');
  const [closingBefore, setClosingBefore] = useState('');
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'board' | 'list'>('board');
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [newStage, setNewStage] = useState('NEW');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [dragging, setDragging] = useState<string | null>(null);
  const loadedOnce = useRef(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await repository.load();
      setBoard(data);
      if (!loadedOnce.current) {
        setPipeline(data.pipelines[0]?.id ?? '');
        loadedOnce.current = true;
      }
    } catch {
      setError(
        'Não foi possível carregar as negociações. Verifique o acesso e tente atualizar.',
      );
    } finally {
      setLoading(false);
    }
  }, [repository]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const stages = pipeline
    ? board.stages.filter((s) => s.pipelineId === pipeline)
    : NATIVE_STAGES;
  const visible = sortDeals(
    board.deals.filter(
      (d) =>
        (d.qualification ?? 0) >= Number(minimumRating) &&
        (!closingBefore ||
          Boolean(d.closeDate && d.closeDate.slice(0, 10) <= closingBefore)) &&
        (d.salesPipelineKey ?? '') === pipeline &&
        (owner === 'ALL' ||
          (owner === 'UNASSIGNED'
            ? !d.ownerId && !d.rdOwnerId
            : owner.startsWith('rd:')
              ? d.rdOwnerId === owner.slice(3)
              : d.ownerId === owner)) &&
        (status === 'ALL' ||
          (status === 'NOT_PAUSED'
            ? d.dealStatus !== 'PAUSED'
            : (d.dealStatus ?? (d.stage === 'CUSTOMER' ? 'WON' : 'ONGOING')) ===
              status)) &&
        `${d.name} ${d.company?.name ?? ''}`
          .toLocaleLowerCase('pt-BR')
          .includes(search.toLocaleLowerCase('pt-BR')),
    ),
    sort,
  );
  const missingStages = [
    ...new Set(
      visible
        .map((d) => (pipeline ? (d.salesStageKey ?? '') : d.stage))
        .filter((id) => !stages.some((s) => s.id === id)),
    ),
  ];
  const columns = [
    ...stages,
    ...missingStages.map((id) => ({
      id,
      name: id ? 'Etapa não mapeada' : 'Sem etapa',
    })),
  ];
  const detail = board.deals.find((d) => d.id === selected);
  const money = (deal: SalesDeal) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: deal.amount?.currencyCode || 'BRL',
    }).format(Number(deal.amount?.amountMicros ?? 0) / 1_000_000);
  const update = async (
    id: string,
    data: Parameters<SalesRepository['update']>[1],
  ) => {
    setBusy(true);
    setError('');
    try {
      await repository.update(id, data);
      await refresh();
    } catch {
      setError(
        'Não foi possível salvar a negociação. Atualize e tente novamente.',
      );
    } finally {
      setBusy(false);
    }
  };
  const move = async (id: string, stageId: string) => {
    setDragging(null);
    await update(
      id,
      pipeline
        ? { salesStageKey: stageId }
        : {
            stage: stageId as
              'NEW' | 'SCREENING' | 'MEETING' | 'PROPOSAL' | 'CUSTOMER',
          },
    );
  };
  const create = async () => {
    setBusy(true);
    setError('');
    try {
      await repository.create(name, pipeline, newStage, newOwner || null);
      setCreating(false);
      setName('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao criar negociação.');
    } finally {
      setBusy(false);
    }
  };
  const ownerOptions = [
    { value: 'ALL', label: 'Todas as negociações' },
    { value: 'UNASSIGNED', label: 'Sem responsável' },
    ...board.members.map((m) => ({ value: m.id, label: m.name })),
    ...[
      ...new Map(
        board.deals
          .filter((d) => d.rdOwnerId && !d.ownerId)
          .map((d) => [
            d.rdOwnerId!,
            {
              value: `rd:${d.rdOwnerId}`,
              label: `${d.rdOwnerName || 'Responsável do RD'} (RD Station)`,
            },
          ]),
      ).values(),
    ],
  ];
  return (
    <main
      style={{
        boxSizing: 'border-box',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        color: theme.font.color.primary,
        background: theme.background.primary,
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        width: '100%',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        {detail && (
          <Button
            aria-label="Voltar às negociações"
            onClick={() => setSelected(null)}
          >
            <IconArrowLeft size={18} />
          </Button>
        )}
        <h1 style={{ margin: 0, fontSize: 28 }}>
          {detail ? detail.name : 'Negociações'}
        </h1>
        {!detail && (
          <>
            <Button
              aria-label="Visualização em quadro"
              onClick={() => setMode('board')}
              disabled={mode === 'board'}
            >
              <IconLayoutKanban size={20} />
            </Button>
            <Button
              aria-label="Visualização em lista"
              onClick={() => setMode('list')}
              disabled={mode === 'list'}
            >
              <IconList size={20} />
            </Button>
          </>
        )}
        <Button
          startIcon={<IconSparkles size={18} />}
          disabled={aiBusy || loading || visible.length === 0}
          onClick={() => {
            setAiBusy(true);
            setError('');
            void executeAppFunction(SALES_PRIORITIES, {
              records: (detail ? [detail] : visible)
                .slice(0, 200)
                .map((d) => ({ id: d.id })),
            })
              .then((result) =>
                setAiSummary((result as { summary: string }).summary),
              )
              .catch(() =>
                setError(
                  'A IA do Twenty não está disponível. Confira o modelo, os créditos e as permissões nas configurações.',
                ),
              )
              .finally(() => setAiBusy(false));
          }}
        >
          {aiBusy ? 'Analisando…' : 'Priorizar com IA'}
        </Button>
        <span style={{ flex: 1 }} />
        <Button
          aria-label="Atualizar negociações"
          disabled={loading || busy}
          onClick={() => void refresh()}
        >
          <IconRefresh size={18} />
        </Button>
        {!detail && (
          <Button
            style={{
              background: '#003d55',
              color: '#00d2ee',
              borderColor: '#003d55',
            }}
            startIcon={<IconPlus size={18} />}
            onClick={() => {
              setNewStage(stages[0]?.id ?? 'NEW');
              setCreating(!creating);
            }}
          >
            Criar
          </Button>
        )}
      </header>
      {error && (
        <div
          role="alert"
          style={{ padding: 14, border: '1px solid #d94b4b', borderRadius: 8 }}
        >
          {error}
        </div>
      )}
      {aiSummary && (
        <section
          style={{
            padding: 18,
            border: `1px solid ${theme.border.color.medium}`,
            borderRadius: 8,
          }}
        >
          <h2>Prioridades sugeridas pela IA</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{aiSummary}</p>
          <small>
            Sugestões para revisão da equipe. Nenhum registro foi alterado.
          </small>
          <Button onClick={() => setAiSummary('')}>Fechar</Button>
        </section>
      )}
      {loading && <p role="status">Carregando negociações e tarefas…</p>}
      {detail ? (
        <div style={{ overflowY: 'auto', minHeight: 0, flex: 1 }}>
          <DealDetail
            deal={detail}
            stages={stages}
            members={board.members}
            busy={busy}
            repository={repository}
            onUpdate={(data) => update(detail.id, data)}
            onRefresh={refresh}
          />
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <Picker
              label="Funil de vendas"
              value={pipeline}
              options={[
                ...board.pipelines.map((p) => ({ value: p.id, label: p.name })),
                { value: '', label: 'Funil padrão do Twenty' },
              ]}
              onChange={setPipeline}
            />
            <Picker
              label="Responsável"
              value={owner}
              options={ownerOptions}
              onChange={setOwner}
            />
            <Picker
              label="Status da negociação"
              value={status}
              options={STATUS_OPTIONS}
              onChange={setStatus}
            />
            <Picker
              label="Ordenação"
              value={sort}
              options={SORT_OPTIONS}
              onChange={setSort}
            />
            <Button
              style={{
                background: 'rgba(0, 205, 230, 0.16)',
                color: '#007da0',
              }}
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              Filtros
              {Number(minimumRating) > 0 || closingBefore
                ? ` (${Number(Number(minimumRating) > 0) + Number(Boolean(closingBefore))})`
                : ''}
            </Button>
            <Input
              aria-label="Buscar negociações"
              placeholder="Buscar negociação ou empresa"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: 280 }}
            />
            <span style={{ color: theme.font.color.secondary }}>
              {visible.length} negociações
            </span>
          </div>
          {filtersOpen && (
            <section
              style={{
                padding: 16,
                border: `1px solid ${theme.border.color.medium}`,
                borderRadius: 8,
                display: 'flex',
                gap: 16,
                flexWrap: 'wrap',
                alignItems: 'end',
              }}
            >
              <Picker
                label="Qualificação mínima"
                value={minimumRating}
                options={[
                  { value: '0', label: 'Todas as qualificações' },
                  ...[1, 2, 3, 4, 5].map((value) => ({
                    value: String(value),
                    label: `Qualificação a partir de ${value}`,
                  })),
                ]}
                onChange={setMinimumRating}
              />
              <label>
                Previsão de fechamento até
                <Input
                  aria-label="Previsão de fechamento até"
                  type="date"
                  value={closingBefore}
                  onChange={(e) => setClosingBefore(e.target.value)}
                />
              </label>
              <Button
                onClick={() => {
                  setMinimumRating('0');
                  setClosingBefore('');
                }}
              >
                Limpar filtros
              </Button>
            </section>
          )}
          {creating && (
            <section
              style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                padding: 18,
                border: `1px solid ${theme.border.color.medium}`,
                borderRadius: 10,
              }}
            >
              <label>
                Nome da negociação
                <Input
                  value={name}
                  aria-label="Nome da negociação"
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <Picker
                label="Etapa inicial"
                value={newStage}
                options={stages.map((s) => ({ value: s.id, label: s.name }))}
                onChange={setNewStage}
              />
              <Picker
                label="Responsável pela nova negociação"
                value={newOwner}
                options={[
                  { value: '', label: 'Sem responsável' },
                  ...board.members.map((m) => ({ value: m.id, label: m.name })),
                ]}
                onChange={setNewOwner}
              />
              <Button
                disabled={busy || !name.trim()}
                onClick={() => void create()}
              >
                Salvar negociação
              </Button>
              <Button onClick={() => setCreating(false)}>Cancelar</Button>
            </section>
          )}
          {!loading && visible.length === 0 && (
            <div
              style={{
                padding: 32,
                background: theme.background.secondary,
                borderRadius: 10,
              }}
            >
              <h2>Nenhuma negociação neste filtro</h2>
              <p>
                Crie uma negociação ou importe seus dados pela página “Importar
                RD Station”.
              </p>
            </div>
          )}
          {mode === 'board' ? (
            <div
              style={{
                display: 'flex',
                overflowX: 'auto',
                gap: 16,
                paddingBottom: 16,
                flex: 1,
                minHeight: 0,
              }}
            >
              {columns.map((stage) => {
                const deals = visible.filter(
                  (d) =>
                    (pipeline ? (d.salesStageKey ?? '') : d.stage) === stage.id,
                );
                const totals = deals.reduce<Record<string, number>>(
                  (sum, d) => {
                    const currency = d.amount?.currencyCode || 'BRL';
                    sum[currency] =
                      (sum[currency] ?? 0) +
                      Number(d.amount?.amountMicros ?? 0) / 1_000_000;
                    return sum;
                  },
                  {},
                );
                return (
                  <section
                    key={stage.id}
                    aria-label={`Etapa ${stage.name}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragging && !busy) void move(dragging, stage.id);
                    }}
                    style={{
                      flex: '0 0 310px',
                      background: theme.background.secondary,
                      border: `1px solid ${theme.border.color.medium}`,
                      borderRadius: 8,
                      padding: 12,
                      minHeight: 0,
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <header
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginBottom: 16,
                        flexShrink: 0,
                      }}
                    >
                      <strong
                        style={{ fontSize: 13, textTransform: 'uppercase' }}
                      >
                        {stage.name} ({deals.length})
                      </strong>
                      <span style={{ fontSize: 12 }}>
                        {Object.entries(totals)
                          .map(([currency, total]) =>
                            new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency,
                            }).format(total),
                          )
                          .join(' + ') || 'R$ 0,00'}
                      </span>
                    </header>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        overflowY: 'auto',
                        minHeight: 0,
                        paddingRight: 3,
                      }}
                    >
                      {deals.map((deal) => (
                        <article
                          key={deal.id}
                          draggable={!busy}
                          onDragStart={() => setDragging(deal.id)}
                          onDragEnd={() => setDragging(null)}
                          style={{
                            border: `1px solid ${theme.border.color.medium}`,
                            borderRadius: 6,
                            padding: 14,
                            background: theme.background.primary,
                            display: 'grid',
                            gap: 12,
                            flexShrink: 0,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              color:
                                (deal.dealStatus ?? 'ONGOING') === 'WON'
                                  ? '#23845b'
                                  : deal.dealStatus === 'LOST'
                                    ? '#cb3a48'
                                    : deal.dealStatus === 'PAUSED'
                                      ? '#b77817'
                                      : '#008caa',
                            }}
                          >
                            ■{' '}
                            {
                              STATUS_OPTIONS.find(
                                (s) =>
                                  s.value ===
                                  (deal.dealStatus ??
                                    (deal.stage === 'CUSTOMER'
                                      ? 'WON'
                                      : 'ONGOING')),
                              )?.label
                            }
                          </span>
                          <button
                            onClick={() => setSelected(deal.id)}
                            style={{
                              border: 0,
                              padding: 0,
                              background: 'transparent',
                              color: 'inherit',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontWeight: 650,
                              fontSize: 14,
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {deal.name}
                          </button>
                          {deal.company && (
                            <span style={{ fontSize: 13 }}>
                              {deal.company.name}
                            </span>
                          )}
                          <div
                            style={{
                              fontSize: 12,
                              color: theme.font.color.secondary,
                            }}
                          >
                            ★ {deal.qualification ?? 0} ·{' '}
                            {deal.owner
                              ? `${deal.owner.name?.firstName ?? ''} ${deal.owner.name?.lastName ?? ''}`
                              : deal.rdOwnerName || 'Sem responsável'}
                          </div>
                          <span style={{ fontSize: 13 }}>{money(deal)}</span>
                          {deal.nextActivityAt && (
                            <span style={{ fontSize: 12 }}>
                              Próxima tarefa:{' '}
                              {new Date(deal.nextActivityAt).toLocaleDateString(
                                'pt-BR',
                              )}
                            </span>
                          )}
                          <Button
                            size="sm"
                            startIcon={<IconPlus size={14} />}
                            onClick={() => setSelected(deal.id)}
                          >
                            Criar tarefa
                          </Button>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div style={{ overflow: 'auto', minHeight: 0, flex: 1 }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                }}
              >
                <thead>
                  <tr>
                    {[
                      'Negociação',
                      'Empresa',
                      'Etapa',
                      'Responsável',
                      'Status',
                      'Valor',
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: 12,
                          borderBottom: `1px solid ${theme.border.color.medium}`,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((deal) => (
                    <tr key={deal.id}>
                      <td style={{ padding: 12 }}>
                        <Button onClick={() => setSelected(deal.id)}>
                          {deal.name}
                        </Button>
                      </td>
                      <td>{deal.company?.name}</td>
                      <td>
                        {stages.find(
                          (s) =>
                            s.id ===
                            (pipeline ? deal.salesStageKey : deal.stage),
                        )?.name ?? 'Sem etapa'}
                      </td>
                      <td>
                        {deal.owner?.name?.firstName ??
                          deal.rdOwnerName ??
                          'Sem responsável'}
                      </td>
                      <td>
                        {
                          STATUS_OPTIONS.find(
                            (s) =>
                              s.value ===
                              (deal.dealStatus ??
                                (deal.stage === 'CUSTOMER'
                                  ? 'WON'
                                  : 'ONGOING')),
                          )?.label
                        }
                      </td>
                      <td>{money(deal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
};

export default defineFrontComponent({
  universalIdentifier: MAIN_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'Negociações',
  description:
    'RD-inspired sales pipeline with native Twenty opportunities, ownership and status filters.',
  component: MainPage,
});
