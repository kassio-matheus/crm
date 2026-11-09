export const createSalesToolbar = (host) => {
  const { React, Button, Dropdown } = host;
  const h = React.createElement;
  const trigger = (label, value, Icon) =>
    h(
      Dropdown.Trigger,
      {
        render: h(Button, {
          'aria-label': label,
          title: value,
          size: 'sm',
          variant: 'outline',
          className: 'crm-sales-quick-trigger',
          startIcon: h(Icon, { size: 16 }),
          endIcon: h(host.Chevron, { size: 14 }),
        }),
      },
      value,
    );

  const select = (label, value, choices, onSelect, Icon) =>
    h(
      Dropdown.Root,
      { type: 'picker' },
      trigger(label, choices.find(([id]) => id === value)?.[1] || label, Icon),
      h(
        Dropdown.Content,
        { 'aria-label': label, align: 'start' },
        h(
          Dropdown.Section,
          { label },
          choices.map(([id, name]) =>
            h(
              Dropdown.OptionItem,
              {
                key: id,
                value: id,
                selected: id === value,
                onSelect: () => onSelect(id),
              },
              name,
            ),
          ),
        ),
      ),
    );

  const Owners = ({ value, currentMember, onChange }) => {
    const client = host.getNative().useCoreClient();
    const [members, setMembers] = React.useState(null);
    const [error, setError] = React.useState(false);
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');
    const [draft, setDraft] = React.useState(value);
    const load = async () => {
      setError(false);
      try {
        const records = await readSnapshot(async ({ after }) => {
          const result = await client.query({
            query: host
              .getNative()
              .gql(
                'query CrmSalesToolbarMembers($after:String){workspaceMembers(first:100,after:$after,orderBy:[{id:AscNullsLast}]){edges{node{id name{firstName lastName}}}pageInfo{hasNextPage endCursor}}}',
              ),
            variables: { after },
            fetchPolicy: 'network-only',
          });
          return result.data.workspaceMembers;
        }, {});
        setMembers(
          records
            .map(({ id, name }) => ({
              id,
              label:
                [name?.firstName, name?.lastName].filter(Boolean).join(' ') ||
                'Sem nome',
            }))
            .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
        );
      } catch {
        setError(true);
      }
    };
    const labels = new Map((members || []).map(({ id, label }) => [id, label]));
    const summary =
      value[0] === 'UNASSIGNED'
        ? 'Sem proprietário'
        : value.length === 0
          ? 'Todos os proprietários'
          : value.length === 1 && value[0] === currentMember?.id
            ? 'Minhas negociações'
            : value.length === 1 && labels.has(value[0])
              ? labels.get(value[0])
              : `${value.length} ${value.length === 1 ? 'proprietário' : 'proprietários'}`;
    const option = (id, label, selected, action) =>
      h(
        Dropdown.OptionItem,
        { key: id, value: id, selected, onSelect: action },
        label,
      );
    const apply = () => {
      onChange(
        draft,
        draft
          .map((id) => labels.get(id))
          .filter(Boolean)
          .join(', '),
      );
      setOpen(false);
    };
    return h(
      Dropdown.Root,
      {
        type: 'picker',
        multiple: true,
        open,
        onOpenChange: (next) => {
          setOpen(next);
          if (next) {
            setDraft(value);
            setSearch('');
            if (members === null) void load();
          }
        },
      },
      trigger('Proprietários', summary, host.OwnerIcon),
      h(
        Dropdown.Content,
        { 'aria-label': 'Proprietários', align: 'start', width: 320 },
        h(Dropdown.Search, {
          value: search,
          onChange: (event) => setSearch(event.target.value),
          placeholder: 'Pesquisar…',
        }),
        h(
          Dropdown.Section,
          null,
          option('all', 'Todas as negociações', !draft.length, () =>
            setDraft([]),
          ),
          currentMember?.id &&
            option(
              'mine',
              'Minhas negociações',
              draft.length === 1 && draft[0] === currentMember.id,
              () => setDraft([currentMember.id]),
            ),
          option(
            'UNASSIGNED',
            'Sem proprietário',
            draft[0] === 'UNASSIGNED',
            () => setDraft(['UNASSIGNED']),
          ),
        ),
        h(
          Dropdown.Section,
          { label: 'Equipe' },
          error
            ? h(
                Dropdown.ActionItem,
                { onClick: () => void load() },
                'Tentar carregar a equipe novamente',
              )
            : members === null
              ? h(Dropdown.Loading, null, 'Carregando equipe…')
              : members
                  .filter(({ label }) =>
                    label
                      .toLocaleLowerCase('pt-BR')
                      .includes(search.toLocaleLowerCase('pt-BR')),
                  )
                  .map(({ id, label }) =>
                    option(id, label, draft.includes(id), () =>
                      setDraft((previous) =>
                        previous.includes(id)
                          ? previous.filter((selected) => selected !== id)
                          : [
                              ...previous.filter(
                                (selected) => selected !== 'UNASSIGNED',
                              ),
                              id,
                            ],
                      ),
                    ),
                  ),
        ),
        h(Dropdown.Separator),
        h(
          'div',
          { className: 'crm-sales-owner-footer' },
          h(
            Button,
            { variant: 'outline', size: 'sm', onClick: () => setDraft([]) },
            'Limpar',
          ),
          h(
            Button,
            { variant: 'solid', size: 'sm', onClick: apply },
            'Aplicar',
          ),
        ),
      ),
    );
  };

  const Toolbar = ({ viewPicker }) => {
    const { objectMetadataItem: object, recordIndexId } = host.useIndex();
    const { currentView } = host.useView();
    const filters = host.useValue(host.filters, recordIndexId);
    const groups = host.useValue(host.groups, recordIndexId);
    const sorts = host.useValue(host.sorts, recordIndexId);
    const setFilters = host.useSet(host.filters, recordIndexId);
    const setGroups = host.useSet(host.groups, recordIndexId);
    const setSorts = host.useSet(host.sorts, recordIndexId);
    const currentMember = host.useMember();
    const scope = salesQuickScope(filters, groups, object.fields);
    const ownerFilter = scope.ownerFilters.find(({ operand }) =>
      ['IS', 'IS_EMPTY'].includes(operand),
    );
    const owners =
      ownerFilter?.operand === 'IS_EMPTY'
        ? ['UNASSIGNED']
        : selectedRelationIds(ownerFilter?.value);
    const changeFilter = (kind, criteria, displayValue) => {
      const added = host.toNativeFilters({
        urlRecursiveFilterGroup: criteria,
        objectMetadataItem: object,
        positionInParent: 0,
      });
      if (kind === 'owner' && displayValue && added.recordFilters.length === 1)
        added.recordFilters[0].displayValue = displayValue;
      const result = replaceSalesQuickFilters({
        filters,
        groups,
        added,
        newId: crypto.randomUUID.bind(crypto),
        removeFilters:
          kind === 'owner' ? scope.ownerFilters : scope.statusFilters,
        removeGroups: kind === 'status' ? scope.statusGroupIds : [],
      });
      setGroups(result.groups);
      setFilters(result.filters);
    };
    const sortChoices = salesSortChoices(
      currentView?.type === 'KANBAN' ? 'rdCreatedAt' : 'createdAt',
    );
    const availableSorts = Object.entries(sortChoices).filter(([, [name]]) =>
      object.fields.some(
        (field) =>
          field.name === name &&
          object.readableFields.some(({ id }) => id === field.id),
      ),
    );
    const sortId = availableSorts.find(([, [name, direction]]) => {
      const field = object.fields.find(
        ({ id }) => id === sorts[0]?.fieldMetadataId,
      );
      return (
        (name === field?.name ||
          (name === 'rdCreatedAt' && field?.name === 'createdAt')) &&
        direction === sorts[0]?.direction
      );
    })?.[0];
    const statuses = [
      ['ALL', 'Todos os status'],
      ['ONGOING', 'Em andamento'],
      ['WON', 'Vendido'],
      ['LOST', 'Perdido'],
      ['PAUSED', 'Pausado'],
      ['NOT_PAUSED', 'Não pausado'],
    ];
    const cell = (label, child) =>
      h(
        'div',
        { className: 'crm-sales-quick-cell' },
        h('span', null, label),
        child,
      );

    return h(
      'div',
      {
        className: 'crm-sales-quick-toolbar',
        'aria-label': 'Filtros rápidos de negociações',
      },
      h(
        'style',
        null,
        `
        .crm-sales-topbar .si9z1zl {height:auto;min-height:39px;align-items:end;gap:8px;flex-wrap:wrap;padding-block:8px;}
        .crm-sales-topbar .ss5bjoo {flex:1 1 min(100%, 650px);min-width:0;}
        .crm-sales-quick-toolbar {display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%, 155px),1fr));width:100%;gap:8px;}
        .crm-sales-quick-cell {display:grid;min-width:0;gap:4px;grid-template-rows:auto 1fr;}
        .crm-sales-quick-cell > span {font-size:var(--t-font-size-xs);color:var(--t-font-color-secondary);}
        .crm-sales-quick-trigger {width:100%;min-height:32px;justify-content:flex-start;white-space:normal;text-align:left;}
        .crm-sales-view-trigger {min-height:32px;height:auto;white-space:normal;}
        .crm-sales-view-trigger .s1eg28jl {max-width:none;overflow:visible;white-space:normal;overflow-wrap:anywhere;}
        .crm-sales-menu-name {white-space:normal;overflow-wrap:anywhere;line-height:1.35;}
        .crm-sales-view-hint {padding:6px 10px;font-size:var(--t-font-size-xs);color:var(--t-font-color-secondary);}
        .crm-sales-owner-footer {display:flex;justify-content:space-between;gap:8px;padding:8px;}
      `,
      ),
      cell('Funil de vendas', viewPicker),
      cell(
        'Proprietários',
        h(Owners, {
          value: owners,
          currentMember,
          onChange: (ids, label) =>
            changeFilter(
              'owner',
              {
                operator: 'AND',
                filters: ids.length
                  ? [
                      {
                        field: 'owner',
                        op: ids[0] === 'UNASSIGNED' ? 'IS_EMPTY' : 'IS',
                        value:
                          ids[0] === 'UNASSIGNED' ? '' : JSON.stringify(ids),
                      },
                    ]
                  : [],
              },
              label,
            ),
        }),
      ),
      cell(
        'Status',
        select(
          'Status da negociação',
          scope.status,
          statuses,
          (status) => changeFilter('status', salesStatusCriteria(status)),
          host.StatusIcon,
        ),
      ),
      cell(
        'Ordenação',
        select(
          'Ordenação',
          sortId,
          availableSorts.map(([id, [, , name]]) => [id, name]),
          (id) => {
            const [name, direction] = sortChoices[id];
            const field = object.fields.find(
              (candidate) => candidate.name === name,
            );
            const idField = object.fields.find(
              (candidate) => candidate.name === 'id',
            );
            setSorts([
              { id: crypto.randomUUID(), fieldMetadataId: field.id, direction },
              ...(idField
                ? [
                    {
                      id: crypto.randomUUID(),
                      fieldMetadataId: idField.id,
                      direction: 'ASC',
                    },
                  ]
                : []),
            ]);
          },
          host.SortIcon,
        ),
      ),
    );
  };
  return Toolbar;
};
