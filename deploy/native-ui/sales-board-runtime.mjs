export const createSalesBoardUi = (host) => {
  const { React } = host;
  const h = React.createElement;
  const Button = ({ stageId }) => {
    const native = host.getHost();
    const { objectMetadataItem } = host.useIndex();
    const { combinedFilters } = host.useQuery();
    const { navigateSidePanel } = native.useNavigate();
    const store = host.useStore();
    if (objectMetadataItem.nameSingular !== 'opportunity' || !stageId)
      return null;
    return h(
      native.Button,
      {
        size: 'sm',
        variant: 'outline',
        'aria-label': 'Selecionar negociações desta fase',
        title: 'Selecionar todas as negociações desta fase',
        style: { flexShrink: 0, width: 24, padding: 0 },
        'data-dnd-drag-disable': true,
        onPointerDown: (event) => event.stopPropagation(),
        onClick: (event) => {
          event.stopPropagation();
          native.bulk.openPhase(
            navigateSidePanel,
            combinedFilters,
            stageId,
            store,
            objectMetadataItem.id,
          );
        },
      },
      h(native.SelectionIcon, { size: 16 }),
    );
  };
  const FilterEffect = () => {
    const { objectMetadataItem, recordIndexId } = host.useIndex();
    const client = host.useClient();
    const store = host.useStore();
    const filters = host.useValue(host.filters),
      groups = host.useValue(host.groups);
    const { filterValueDependencies } = host.useDependencies();
    const fields = host.useAtomValue(host.fields);
    const filter = host.computeFilter({
      recordFilters: filters,
      recordFilterGroups: groups,
      fieldMetadataItems: fields,
      filterValueDependencies,
    });
    const pipelines = relationIds(filter, 'salesPipelineId');
    const stages = relationIds(filter, 'salesStageId');
    const key = JSON.stringify([pipelines, stages]);
    React.useEffect(() => {
      let active = true;
      const atom = host.scope.atomFamily({ instanceId: recordIndexId });
      if (objectMetadataItem.nameSingular !== 'opportunity' || !pipelines) {
        store.set(atom, null);
        return;
      }
      store.set(atom, []);
      const load = async () => {
        const ids = [],
          seen = new Set();
        let after = null;
        do {
          const result = await client.query({
            query: host
              .getHost()
              .gql(
                'query CrmBoardStageScope($filter:SalesStageFilterInput!,$after:String){salesStages(first:100,after:$after,filter:$filter,orderBy:[{id:AscNullsLast}]){edges{node{id}}pageInfo{hasNextPage endCursor}}}',
              ),
            variables: {
              filter: {
                salesPipelineId: { in: pipelines },
                ...(stages ? { id: { in: stages } } : {}),
              },
              after,
            },
            fetchPolicy: 'network-only',
          });
          const page = result.data.salesStages;
          ids.push(...page.edges.map(({ node }) => node.id));
          after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
          if (after && seen.has(after))
            throw new Error('Stage pagination stalled.');
          seen.add(after);
        } while (after);
        if (active) store.set(atom, ids);
      };
      // Fail closed: never expose columns from another pipeline on a failed read.
      void load().catch(() => {
        if (active) store.set(atom, []);
      });
      return () => {
        active = false;
      };
    }, [recordIndexId, objectMetadataItem.nameSingular, key]);
    return null;
  };
  return { Button, FilterEffect };
};
