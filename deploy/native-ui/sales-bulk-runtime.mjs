// Runs inside Twenty's native module, using its existing React, Apollo, UI and
// permission-aware record hooks. No DOM injection, credentials or external API.
export const createSalesBulkUi = (host) => {
  const { React, Button, Dropdown, Form, Dialog, useTheme } = host;
  const h = React.createElement;
  const scopes = new Map();
  const labels = {
    pipeline: 'Alterar funil',
    stage: 'Alterar fase do funil',
    duplicate: 'Duplicar',
    delete: 'Excluir',
    fields: 'Atualizar campos em massa',
  };

  const useFilter = (id, object) => {
    const rule = host.useStateValue(host.rule, id);
    const filters = host.useStateValue(host.filters, id);
    const groups = host.useStateValue(host.groups, id);
    const search = host.useStateValue(host.search, id);
    const { filterValueDependencies } = host.useDependencies();
    const fields = host.useAtomValue(host.fields);
    // A scoped selection must never degrade to the whole workspace if the
    // in-memory scope was lost (for example, after a reload).
    if (id.startsWith('crm-') && !scopes.has(id)) return { id: { in: [] } };
    return (
      scopes.get(id)?.filter ??
      host.computeFilter({
        contextStoreTargetedRecordsRule: rule,
        contextStoreFilters: filters,
        contextStoreFilterGroups: groups,
        contextStoreAnyFieldFilterValue: search,
        objectMetadataItem: object,
        fieldMetadataItems: fields,
        filterValueDependencies,
      })
    );
  };

  const Picker = ({ label, value, options, onChange, disabled }) => {
    const [search, setSearch] = React.useState('');
    const theme = useTheme();
    return h(
      'div',
      { style: { display: 'grid', gap: theme.spacing[1], minWidth: 0 } },
      h(
        'span',
        {
          style: {
            fontSize: theme.font.size.sm,
            color: theme.font.color.secondary,
          },
        },
        label,
      ),
      h(
        Dropdown.Root,
        { type: 'picker' },
        h(
          Dropdown.Trigger,
          {
            render: h(Button, {
              variant: 'outline',
              size: 'sm',
              endIcon: host.ChevronIcon && h(host.ChevronIcon, { size: 16 }),
              style: {
                width: '100%',
                justifyContent: 'space-between',
                minHeight: 32,
              },
              disabled,
              'aria-label': label,
            }),
          },
          options.find((item) => item.id === value)?.name || 'Selecionar…',
        ),
        h(
          Dropdown.Content,
          { 'aria-label': label },
          h(Dropdown.Search, {
            value: search,
            onChange: (event) => setSearch(event.target.value),
            placeholder: 'Pesquisar…',
          }),
          h(
            Dropdown.Section,
            null,
            options
              .filter((item) =>
                item.name
                  .toLocaleLowerCase()
                  .includes(search.toLocaleLowerCase()),
              )
              .map((item) =>
                h(
                  Dropdown.OptionItem,
                  {
                    key: item.id,
                    value: item.id,
                    selected: value === item.id,
                    onSelect: () => onChange(item.id),
                  },
                  item.name,
                ),
              ),
          ),
          !options.length &&
            h(Dropdown.Empty, null, 'Nenhuma etapa disponível'),
        ),
      ),
    );
  };

  const Panel = ({ contextStoreInstanceId: id }) => {
    const theme = useTheme();
    const client = host.useCoreClient();
    const { objectMetadataItem: object } = host.useMetadata({
      objectNameSingular: 'opportunity',
    });
    const filter = useFilter(id, object);
    const filterKey = JSON.stringify(filter);
    const { createManyRecords } = host.useCreate({
      objectNameSingular: 'opportunity',
    });
    const { updateManyRecords } = host.useUpdate({
      objectNameSingular: 'opportunity',
    });
    const { objectPermissionsByObjectMetadataId } = host.usePermissions();
    const permissions = objectPermissionsByObjectMetadataId[object.id];
    const { enqueueToast } = host.useToast();
    const { openDialog } = host.useDialog();
    const [action, setAction] = React.useState('');
    const [values, setValues] = React.useState({});
    const [catalog, setCatalog] = React.useState({ pipelines: [], stages: [] });
    const [rows, setRows] = React.useState(null);
    const [pipeline, setPipeline] = React.useState('');
    const [stage, setStage] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState('');
    const [progress, setProgress] = React.useState(0);
    const [finished, setFinished] = React.useState(false);
    const running = React.useRef(false);
    const dialogId = `crm-bulk-confirm-${id}`;
    const deleteManyRecords = async ({ recordIdsToDelete }) => {
      const result = await client.mutate({
        mutation: host.gql(
          'mutation CrmBulkSoftDelete($filter:OpportunityFilterInput!){deleteOpportunities(filter:$filter){id deletedAt}}',
        ),
        variables: { filter: { id: { in: recordIdsToDelete } } },
      });
      assertBatchResult(result.data?.deleteOpportunities, recordIdsToDelete);
      await client.refetchQueries({ include: 'active' });
    };
    const read = async ({ filter, after, fields }) => {
      const result = await client.query({
        query: host.gql(
          `query CrmBulkSnapshot($filter:OpportunityFilterInput!,$after:String){opportunities(first:100,after:$after,filter:$filter,orderBy:[{id:AscNullsLast}]){edges{node{${fields}}}pageInfo{hasNextPage endCursor}}}`,
        ),
        variables: { filter, after },
        fetchPolicy: 'network-only',
      });
      return result.data.opportunities;
    };
    const load = async () => {
      setRows(null);
      setError('');
      setFinished(false);
      if (id.startsWith('crm-') && !scopes.has(id)) {
        setRows([]);
        setError(
          'Esta seleção expirou. Feche o painel e selecione novamente a fase.',
        );
        return;
      }
      try {
        const snapshot = await readSnapshot(
          read,
          filter,
          'id salesPipelineId salesStageId',
        );
        setRows(snapshot);
        const unique = [
          ...new Set(
            snapshot.map((row) => row.salesPipelineId).filter(Boolean),
          ),
        ];
        setPipeline(unique.length === 1 ? unique[0] : '');
        setStage('');
      } catch {
        setError(
          'Não foi possível carregar toda a seleção. Nenhuma alteração foi feita. Tente novamente.',
        );
      }
    };
    React.useEffect(() => {
      void load();
    }, [filterKey]);
    React.useEffect(() => {
      let active = true;
      const readCatalog = async (name, fields) => {
        const all = [];
        let after = null;
        const cursors = new Set();
        do {
          const result = await client.query({
            query: host.gql(
              `query CrmBulkCatalog($after:String){${name}(first:100,after:$after,orderBy:[{id:AscNullsLast}]){edges{node{${fields}}}pageInfo{hasNextPage endCursor}}}`,
            ),
            variables: { after },
            fetchPolicy: 'network-only',
          });
          const page = result.data[name];
          all.push(...page.edges.map(({ node }) => node));
          after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
          if (after && cursors.has(after))
            throw new Error('Catalog pagination stalled.');
          cursors.add(after);
        } while (after);
        return all;
      };
      Promise.all([
        readCatalog('salesPipelines', 'id name'),
        readCatalog('salesStages', 'id name salesPipelineId sourceOrder'),
      ])
        .then(([pipelines, stages]) => {
          if (active) setCatalog({ pipelines, stages });
        })
        .catch(() => {
          if (active)
            setError(
              'Não foi possível carregar os funis e etapas. Reabra o painel para tentar novamente.',
            );
        });
      return () => {
        active = false;
      };
    }, []);

    const canRun =
      action === 'duplicate'
        ? permissions?.canUpdateObjectRecords && object.isUICreatable
        : action === 'delete'
          ? permissions?.canSoftDeleteObjectRecords
          : permissions?.canUpdateObjectRecords;
    const targetStages = catalog.stages
      .filter((item) => item.salesPipelineId === pipeline)
      .sort(
        (a, b) =>
          (a.sourceOrder ?? Infinity) - (b.sourceOrder ?? Infinity) ||
          a.name.localeCompare(b.name),
      );
    const requestConfirmation = () => {
      if (!rows?.length || running.current || !canRun || finished) return;
      setError('');
      try {
        if (action === 'pipeline' || action === 'stage')
          validateMove(action, pipeline, stage, catalog.stages);
      } catch (failure) {
        setError(failure.message);
        return;
      }
      openDialog(dialogId);
    };
    const execute = async () => {
      if (running.current || !rows?.length || !canRun || finished) return;
      running.current = true;
      setBusy(true);
      setProgress(0);
      setError('');
      let completed = 0;
      try {
        // Freeze IDs BEFORE any mutation. Moving/deleting records cannot skip a
        // cursor page, and duplicates can never become input to their own job.
        let sourceRows = rows;
        if (action === 'duplicate') {
          const readable = new Set(
            object.readableFields.map((field) => field.name),
          );
          const fields = [
            'id',
            ...object.fields
              .filter(
                (field) =>
                  readable.has(field.name) &&
                  host.isEditable(field) &&
                  !['RELATION', 'MORPH_RELATION'].includes(field.type),
              )
              .map(printField),
            ...object.fields
              .filter(
                (field) =>
                  readable.has(field.name) &&
                  ['RELATION'].includes(field.type) &&
                  field.settings?.relationType === 'MANY_TO_ONE',
              )
              .map(
                (field) => field.settings.joinColumnName || `${field.name}Id`,
              ),
          ];
          sourceRows = await readSnapshot(
            read,
            { id: { in: rows.map((row) => row.id) } },
            [...new Set(fields)].join(' '),
          );
          assertBatchResult(
            sourceRows,
            rows.map((row) => row.id),
          );
        }
        let data = values;
        if (action === 'pipeline' || action === 'stage') {
          // Recheck the relationship immediately before writing, after confirmation.
          const result = await client.query({
            query: host.gql(
              'query CrmValidateStage($id:UUID!){salesStage(filter:{id:{eq:$id}}){id salesPipelineId}}',
            ),
            variables: { id: stage },
            fetchPolicy: 'network-only',
          });
          data = validateMove(
            action,
            pipeline,
            stage,
            result.data.salesStage ? [result.data.salesStage] : [],
          );
        }
        for (let offset = 0; offset < sourceRows.length; offset += 25) {
          const batch = sourceRows.slice(offset, offset + 25),
            ids = batch.map((row) => row.id);
          if (action === 'delete')
            await deleteManyRecords({ recordIdsToDelete: ids });
          else if (action === 'duplicate') {
            const copies = batch.map((row) =>
              copyDeal(row, object.fields, crypto.randomUUID()),
            );
            assertBatchResult(
              await createManyRecords({ recordsToCreate: copies }),
              copies.map((row) => row.id),
            );
          } else
            assertBatchResult(
              await updateManyRecords({
                recordIdsToUpdate: ids,
                updateOneRecordInput: data,
              }),
              ids,
            );
          completed += batch.length;
          setProgress(completed);
        }
        setFinished(true);
        enqueueToast({
          status: 'success',
          children: `${labels[action]}: ${completed} negociações processadas.`,
        });
      } catch {
        setError(
          `A operação parou com ${completed} de ${rows.length} negociações confirmadas. O lote atual pode ter alterações parciais. Confira os registros antes de tentar novamente; as alterações concluídas foram mantidas.`,
        );
        // Never replay a partially completed duplicate job from the same panel.
        setFinished(true);
      } finally {
        running.current = false;
        setBusy(false);
      }
    };
    const sectionStyle = {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing[3],
      padding: theme.spacing[4],
      color: theme.font.color.primary,
    };
    const actionButton = (key) =>
      h(
        Button,
        {
          key,
          variant: action === key ? 'solid' : 'outline',
          size: 'sm',
          startIcon: host.icons?.[key] && h(host.icons[key], { size: 16 }),
          disabled:
            busy ||
            finished ||
            !rows?.length ||
            (key === 'delete'
              ? !permissions?.canSoftDeleteObjectRecords
              : key === 'duplicate'
                ? !(permissions?.canUpdateObjectRecords && object.isUICreatable)
                : !permissions?.canUpdateObjectRecords),
          onClick: () => {
            setAction(key);
            setValues({});
            setError('');
          },
          style: { justifyContent: 'flex-start' },
        },
        labels[key],
      );
    return h(
      'section',
      { 'aria-label': 'Ações em massa', style: sectionStyle },
      h(
        'strong',
        null,
        rows
          ? rows.length === 1
            ? '1 negociação selecionada'
            : `${rows.length} negociações selecionadas`
          : 'Carregando toda a seleção…',
      ),
      h(
        'span',
        { style: { color: theme.font.color.secondary } },
        scopes.get(id)
          ? 'Todas as negociações desta fase que atendem aos filtros atuais, incluindo as que não estavam carregadas no quadro.'
          : 'As ações serão aplicadas somente aos registros selecionados.',
      ),
      error &&
        h(
          'div',
          { role: 'alert' },
          error,
          !rows &&
            h(Button, { onClick: () => void load() }, 'Tentar novamente'),
        ),
      ...['pipeline', 'stage', 'duplicate', 'delete', 'fields'].map(
        actionButton,
      ),
      action === 'fields' &&
        h(Form, {
          objectNameSingular: 'opportunity',
          disabled: busy || finished,
          values,
          onChange: (key, value) =>
            setValues((current) => ({ ...current, [key]: value })),
          crmBulk: true,
        }),
      ['pipeline', 'stage'].includes(action) &&
        h(
          React.Fragment,
          null,
          h(Picker, {
            label: 'Funil de destino',
            value: pipeline,
            options: catalog.pipelines,
            onChange: (value) => {
              setPipeline(value);
              setStage('');
            },
            disabled: busy || finished,
          }),
          h(Picker, {
            label: 'Etapa de destino',
            value: stage,
            options: targetStages,
            onChange: setStage,
            disabled: busy || finished || !pipeline,
          }),
        ),
      action === 'duplicate' &&
        h(
          'p',
          null,
          'Cria novas negociações com os campos e o proprietário. Não duplica tarefas, notas nem a identidade de importação do RD.',
        ),
      action === 'delete' &&
        h(
          'p',
          null,
          'As negociações serão movidas para a lixeira do Twenty e poderão ser restauradas.',
        ),
      (busy || progress > 0) &&
        h(
          'div',
          { role: 'status', 'aria-live': 'polite' },
          `${progress} de ${rows?.length || 0} processadas`,
          h('progress', {
            value: progress,
            max: rows?.length || 1,
            style: { width: '100%' },
          }),
        ),
      finished
        ? h(
            'p',
            { role: 'status' },
            'Operação encerrada. Reabra a seleção para executar outra ação.',
          )
        : action &&
            h(
              Button,
              {
                variant: 'solid',
                disabled:
                  busy ||
                  !rows?.length ||
                  !canRun ||
                  (action === 'fields' &&
                    !Object.values(values).some(
                      (value) => value !== undefined,
                    )),
                onClick: requestConfirmation,
              },
              busy
                ? 'Processando…'
                : `${labels[action]} · ${rows?.length || 0}`,
            ),
      h(Dialog, {
        dialogId,
        title: `${labels[action] || 'Ação'} em ${rows?.length || 0} ${rows?.length === 1 ? 'negociação' : 'negociações'}?`,
        subtitle:
          action === 'duplicate'
            ? 'Serão criadas novas negociações. Os registros originais serão preservados.'
            : action === 'delete'
              ? 'Os registros selecionados serão enviados para a lixeira.'
              : action === 'fields'
                ? 'Somente os campos preenchidos serão atualizados nos registros selecionados.'
                : `Destino: ${catalog.pipelines.find((item) => item.id === pipeline)?.name || ''} / ${targetStages.find((item) => item.id === stage)?.name || ''}. Confira a seleção antes de confirmar.`,
        onConfirmClick: execute,
        confirmButtonText: labels[action] || 'Confirmar',
        confirmButtonColor: action === 'delete' ? 'danger' : 'accent',
      }),
    );
  };

  const openPhase = (navigate, filter, stageId, store, objectId) => {
    const id = `crm-phase-${crypto.randomUUID()}`;
    scopes.set(id, { filter: phaseScope(filter, stageId) });
    store.set(host.objectId.atomFamily({ instanceId: id }), objectId);
    store.set(host.rule.atomFamily({ instanceId: id }), {
      mode: 'selection',
      selectedRecordIds: [],
    });
    // Keep a bounded session cache. Opening a panel never writes business data.
    if (scopes.size > 30) scopes.delete(scopes.keys().next().value);
    navigate({
      page: 'update-records',
      pageId: id,
      pageTitle: 'Ações em massa',
      pageIcon: host.BulkIcon,
    });
  };
  return { Panel, Picker, openPhase, hasScope: (id) => scopes.has(id) };
};
