// Dedicated native side panel. Dropdowns are hosted by Twenty itself rather
// than crossing the front-component worker/portal boundary.
export const createSalesFiltersUi = (host) => {
  const scopes = new Map();
  const { React, Button, Section, Picker } = host;
  const h = React.createElement;
  const Panel = ({ contextStoreInstanceId: id }) => {
    const client = host.useCoreClient(),
      theme = host.useTheme(),
      navigate = host.useNavigateApp();
    const { closeSidePanelMenu } = host.useSidePanel();
    const parent = scopes.get(id);
    const { objectMetadataItem: object } = host.useMetadata({
      objectNameSingular: 'opportunity',
    });
    const current = host.useStateValue(host.filters, parent.contextId);
    const currentIds = (name) => {
      const field = object.fields.find((field) => field.name === name);
      const filter = current.find(
        (filter) =>
          filter.fieldMetadataId === field?.id && filter.operand === 'IS',
      );
      try {
        const value = JSON.parse(filter?.value || '[]');
        return Array.isArray(value) ? value : value.selectedRecordIds || [];
      } catch {
        return [];
      }
    };
    const [value, setValue] = React.useState(() => ({
      pipelineId: currentIds('salesPipeline')[0] || '',
      stageId: currentIds('salesStage')[0] || '',
      ownerId: currentIds('owner')[0] || '',
      status: currentIds('dealStatus')[0] || 'ALL',
      sort: 'newest',
      mode: currentIds('salesPipeline').length ? 'board' : 'list',
    }));
    const [catalog, setCatalog] = React.useState(null),
      [error, setError] = React.useState(''),
      [busy, setBusy] = React.useState(false),
      [count, setCount] = React.useState(null);
    const load = async () => {
      setError('');
      try {
        const list = async (name, fields) =>
          readSnapshot(async ({ after }) => {
            const result = await client.query({
              query: host.gql(
                `query CrmNativeFilterCatalog($after:String){${name}(first:100,after:$after,orderBy:[{id:AscNullsLast}]){edges{node{${fields}}}pageInfo{hasNextPage endCursor}}}`,
              ),
              variables: { after },
              fetchPolicy: 'network-only',
            });
            return result.data[name];
          }, {});
        const [pipelines, stages, members, views] = await Promise.all([
          list('salesPipelines', 'id name'),
          list('salesStages', 'id name salesPipelineId sourceOrder'),
          list('workspaceMembers', 'id name{firstName lastName}'),
          client.query({
            query: host.gql('{getViews{id type universalIdentifier}}'),
            context: { uri: '/metadata' },
            fetchPolicy: 'network-only',
          }),
        ]);
        const listView = views.data.getViews.find(
          (view) =>
            view.universalIdentifier ===
              '61ffa589-0245-4cc4-b188-c2bddf8d01a1' && view.type === 'TABLE',
        );
        if (!listView) throw new Error('Native list is missing.');
        setCatalog({
          pipelines,
          stages,
          members: members.map((member) => ({
            id: member.id,
            name:
              [member.name?.firstName, member.name?.lastName]
                .filter(Boolean)
                .join(' ') || 'Sem nome',
          })),
          listViewId: listView.id,
        });
      } catch {
        setError('Não foi possível carregar os filtros. Tente novamente.');
      }
    };
    React.useEffect(() => {
      void load();
    }, []);
    const stages =
      catalog?.stages
        .filter((stage) => stage.salesPipelineId === value.pipelineId)
        .sort(
          (a, b) =>
            (a.sourceOrder ?? Infinity) - (b.sourceOrder ?? Infinity) ||
            a.name.localeCompare(b.name),
        ) || [];
    React.useEffect(() => {
      if (!catalog) return;
      let active = true;
      setCount(null);
      const timeout = setTimeout(() => {
        client
          .query({
            query: host.gql(
              'query CrmFilterCount($filter:OpportunityFilterInput!){opportunities(first:1,filter:$filter){totalCount}}',
            ),
            variables: { filter: salesFilterPredicate(value) },
            fetchPolicy: 'network-only',
          })
          .then((result) => {
            if (active) setCount(result.data.opportunities.totalCount);
          })
          .catch(() => {
            if (active) setCount(null);
          });
      }, 250);
      return () => {
        active = false;
        clearTimeout(timeout);
      };
    }, [catalog, value.pipelineId, value.stageId, value.ownerId, value.status]);
    const apply = () => {
      if (!catalog) return;
      if (
        value.stageId &&
        !stages.some((stage) => stage.id === value.stageId)
      ) {
        setError('Selecione uma etapa do funil escolhido.');
        return;
      }
      setBusy(true);
      navigate(
        host.RecordIndexPage,
        { objectNamePlural: 'opportunities' },
        salesFilterQuery(value, catalog.listViewId),
      );
      closeSidePanelMenu();
    };
    const pick = (key, label, options) =>
      h(Picker, {
        label,
        value: value[key],
        options,
        onChange: (next) => {
          setValue((current) => ({
            ...current,
            [key]: next,
            ...(key === 'pipelineId'
              ? { stageId: '', mode: next ? 'board' : 'list' }
              : {}),
          }));
          setError('');
        },
        disabled: busy || (key === 'stageId' && !value.pipelineId),
      });
    return h(
      'section',
      {
        'aria-label': 'Filtros de negociações',
        style: {
          padding: theme.spacing[4],
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing[4],
          color: theme.font.color.primary,
        },
      },
      h(Section.Header, {
        title: 'Funil e etapas',
        description:
          'Escolha o funil e refine as negociações exibidas no quadro.',
      }),
      error &&
        h(
          'div',
          { role: 'alert' },
          error,
          h(Button, { onClick: () => void load() }, 'Tentar novamente'),
        ),
      !catalog &&
        !error &&
        h('p', { role: 'status' }, 'Carregando funis, etapas e responsáveis…'),
      catalog &&
        h(
          React.Fragment,
          null,
          pick('pipelineId', 'Funil de vendas', [
            { id: '', name: 'Todas as negociações · Lista' },
            ...catalog.pipelines,
          ]),
          pick('stageId', 'Etapa do funil', [
            { id: '', name: 'Todas as etapas deste funil' },
            ...stages,
          ]),
          pick('ownerId', 'Responsável', [
            { id: '', name: 'Todos os responsáveis' },
            { id: 'UNASSIGNED', name: 'Sem responsável' },
            ...catalog.members,
          ]),
          pick('status', 'Status da negociação', [
            { id: 'ALL', name: 'Todos os status' },
            { id: 'ONGOING', name: '▶ Em andamento' },
            { id: 'WON', name: '✓ Vendido' },
            { id: 'LOST', name: '✕ Perdido' },
            { id: 'PAUSED', name: 'Ⅱ Pausado' },
            { id: 'NOT_PAUSED', name: 'Não pausado' },
          ]),
          pick('sort', 'Ordenação', [
            { id: 'newest', name: 'Criadas por último' },
            { id: 'oldest', name: 'Criadas primeiro' },
            { id: 'nameAsc', name: 'Alfabética A–Z' },
            { id: 'nameDesc', name: 'Alfabética Z–A' },
            { id: 'nextTask', name: 'Próxima tarefa' },
            { id: 'closeDate', name: 'Previsão de fechamento' },
            { id: 'lastContact', name: 'Contato mais recente' },
            { id: 'oldestContact', name: 'Contato mais antigo' },
            { id: 'rating', name: 'Mais qualificadas' },
          ]),
          pick(
            'mode',
            'Visualização',
            value.pipelineId
              ? [
                  { id: 'board', name: 'Kanban · uma coluna por etapa' },
                  { id: 'list', name: 'Lista' },
                ]
              : [{ id: 'list', name: 'Lista' }],
          ),
          h(
            'div',
            {
              role: 'status',
              'aria-live': 'polite',
              style: { color: theme.font.color.secondary },
            },
            count === null
              ? 'Conferindo os critérios…'
              : `${count} ${count === 1 ? 'negociação encontrada' : 'negociações encontradas'}`,
          ),
          h(
            'div',
            {
              style: {
                display: 'flex',
                gap: theme.spacing[2],
                flexWrap: 'wrap',
              },
            },
            h(
              Button,
              { variant: 'solid', disabled: busy, onClick: apply },
              'Aplicar filtros',
            ),
            h(
              Button,
              {
                variant: 'outline',
                disabled: busy,
                onClick: () =>
                  setValue((current) => ({
                    ...current,
                    stageId: '',
                    ownerId: '',
                    status: 'ALL',
                    sort: 'newest',
                  })),
              },
              'Limpar critérios',
            ),
          ),
        ),
    );
  };
  return {
    Panel,
    hasScope: (id) => scopes.has(id),
    open: (navigate, store, contextId, objectId) => {
      const id = `crm-filters-${crypto.randomUUID()}`;
      scopes.set(id, { contextId });
      if (scopes.size > 30) scopes.delete(scopes.keys().next().value);
      store.set(host.objectId.atomFamily({ instanceId: id }), objectId);
      navigate({
        page: 'update-records',
        pageId: id,
        pageTitle: 'Filtros de negociações',
        pageIcon: host.FilterIcon,
      });
    },
  };
};
