import { useEffect, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import {
  AppPath,
  closeSidePanel,
  navigate,
  useUserId,
} from 'twenty-sdk/front-component';
import { Button } from 'twenty-ui/primitives/input';
import { useTheme } from 'twenty-ui/theme';
import { MAIN_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { Picker } from 'src/front-components/components/picker';
import { loadSalesFilterOptions } from 'src/front-components/utils/load-sales-filter-options.util';
import { buildNativeSalesQuery } from 'src/utils/build-native-sales-query.util';
import type { NativeSalesFilters } from 'src/types/native-sales-filters';

const defaults: NativeSalesFilters = {
  pipelineId: '',
  ownerId: '',
  status: 'ALL',
  sort: 'newest',
  mode: 'board',
};
const statuses = [
  { value: 'ALL', label: 'Todos os status' },
  { value: 'ONGOING', label: 'Em andamento' },
  { value: 'WON', label: 'Vendido' },
  { value: 'LOST', label: 'Perdido' },
  { value: 'PAUSED', label: 'Pausado' },
  { value: 'NOT_PAUSED', label: 'Não pausado' },
];
const sorts = [
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

const SalesFilters = () => {
  const theme = useTheme();
  const userId = useUserId();
  const [filters, setFilters] = useState(defaults);
  const [options, setOptions] = useState<Awaited<
    ReturnType<typeof loadSalesFilterOptions>
  > | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setError('');
    try {
      setOptions(await loadSalesFilterOptions());
    } catch {
      setError('Não foi possível carregar os filtros. Tente novamente.');
    }
  };
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(`sales-filters:${userId}`) || 'null',
      );
      if (saved && typeof saved === 'object')
        setFilters({ ...defaults, ...saved });
    } catch {
      /* A missing or obsolete local preference does not block filtering. */
    }
  }, [userId]);
  const apply = async (value: NativeSalesFilters) => {
    if (!options) return;
    setBusy(true);
    setError('');
    try {
      const query = buildNativeSalesQuery(value, options.views);
      localStorage.setItem(`sales-filters:${userId}`, JSON.stringify(value));
      await navigate(
        AppPath.RecordIndexPage,
        { objectNamePlural: 'opportunities' },
        query,
        { surface: 'main' },
      );
      await closeSidePanel();
    } catch {
      setError('Não foi possível aplicar os filtros. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };
  const change = (key: keyof NativeSalesFilters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  return (
    <section
      aria-label="Filtros de negociações"
      style={{
        padding: theme.spacing[4],
        color: theme.font.color.primary,
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing[4],
        maxWidth: 560,
      }}
    >
      <div>
        <h2 style={{ fontSize: theme.font.size.lg, margin: 0 }}>
          Filtrar negociações
        </h2>
        <p style={{ color: theme.font.color.secondary }}>
          Escolha os critérios e aplique ao quadro ou à lista do Twenty.
        </p>
      </div>
      {error && (
        <div role="alert">
          {error}
          <Button onClick={() => void load()}>Tentar novamente</Button>
        </div>
      )}
      {!options && !error && (
        <p role="status">Carregando funis e responsáveis…</p>
      )}
      {options && (
        <>
          <Picker
            label="Funil de vendas"
            value={filters.pipelineId}
            options={[
              { value: '', label: 'Todas as negociações' },
              ...options.pipelines.map((p) => ({ value: p.id, label: p.name })),
            ]}
            onChange={(v) => change('pipelineId', v)}
            disabled={busy}
          />
          <Picker
            label="Responsável"
            value={filters.ownerId}
            options={[
              { value: '', label: 'Todos os responsáveis' },
              { value: 'UNASSIGNED', label: 'Sem responsável' },
              ...options.members.map((m) => ({ value: m.id, label: m.name })),
            ]}
            onChange={(v) => change('ownerId', v)}
            disabled={busy}
          />
          <Picker
            label="Status da negociação"
            value={filters.status}
            options={statuses}
            onChange={(v) => change('status', v)}
            disabled={busy}
          />
          <Picker
            label="Ordenação"
            value={filters.sort}
            options={sorts}
            onChange={(v) => change('sort', v)}
            disabled={busy}
          />
          <Picker
            label="Visualização"
            value={filters.mode}
            options={[
              { value: 'board', label: 'Quadro' },
              { value: 'list', label: 'Lista' },
            ]}
            onChange={(v) => change('mode', v)}
            disabled={busy}
          />
          <div
            style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}
          >
            <Button
              variant="solid"
              style={{
                background: theme.background.invertedPrimary,
                color: theme.font.color.inverted,
                padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                minHeight: 36,
                borderRadius: theme.border.radius.sm,
                border: 'none',
              }}
              disabled={busy}
              onClick={() => void apply(filters)}
            >
              {busy ? 'Aplicando…' : 'Aplicar filtros'}
            </Button>
            <Button
              disabled={busy}
              style={{
                background: theme.background.primary,
                color: theme.font.color.primary,
                padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                minHeight: 36,
                borderRadius: theme.border.radius.sm,
                border: `1px solid ${theme.border.color.medium}`,
              }}
              onClick={() => {
                setFilters(defaults);
                void apply(defaults);
              }}
            >
              Limpar filtros
            </Button>
          </div>
          <p
            style={{
              color: theme.font.color.tertiary,
              fontSize: theme.font.size.sm,
            }}
          >
            Para combinar mais critérios, use o filtro avançado do Twenty no
            quadro.
          </p>
        </>
      )}
    </section>
  );
};

export default defineFrontComponent({
  universalIdentifier: MAIN_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'Negociações',
  description:
    'Quick filters for the native Twenty opportunity board and list.',
  component: SalesFilters,
});
