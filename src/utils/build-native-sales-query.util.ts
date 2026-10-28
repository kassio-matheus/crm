import type { NativeSalesFilters } from 'src/types/native-sales-filters';

/** Native URL filters are transient: no shared view or CRM record is written. */
export const buildNativeSalesQuery = (
  filters: NativeSalesFilters,
  views: {
    board: string;
    pipelineBoard: string;
    list: string;
    pipelineViews?: Record<string, string>;
  },
): Record<string, string> => {
  const query: Record<string, string> = {
    viewId:
      filters.mode === 'list'
        ? views.list
        : filters.pipelineId
          ? (views.pipelineViews?.[filters.pipelineId] ?? views.pipelineBoard)
          : views.board,
  };
  const roots: { field: string; op: string; value: string }[] = [];
  if (filters.pipelineId)
    roots.push({
      field: 'salesPipeline',
      op: 'IS',
      value: JSON.stringify([filters.pipelineId]),
    });
  if (filters.pipelineId && filters.stageId)
    roots.push({
      field: 'salesStage',
      op: 'IS',
      value: JSON.stringify([filters.stageId]),
    });
  if (filters.ownerId)
    roots.push({
      field: 'owner',
      op: filters.ownerId === 'UNASSIGNED' ? 'IS_EMPTY' : 'IS',
      value:
        filters.ownerId === 'UNASSIGNED'
          ? ''
          : JSON.stringify([filters.ownerId]),
    });
  const groups: object[] = [];
  if (filters.status === 'ONGOING' || filters.status === 'WON') {
    const explicit = {
      field: 'dealStatus',
      op: 'IS',
      value: JSON.stringify([filters.status]),
    };
    // Equivalent to explicit status OR (empty status AND legacy stage), with shallow URL groups.
    groups.push({
      operator: 'OR',
      filters: [explicit, { field: 'dealStatus', op: 'IS_EMPTY', value: '' }],
    });
    groups.push({
      operator: 'OR',
      filters: [
        explicit,
        {
          field: 'stage',
          op: filters.status === 'WON' ? 'IS' : 'IS_NOT',
          value: '["CUSTOMER"]',
        },
      ],
    });
  } else if (filters.status === 'NOT_PAUSED')
    groups.push({
      operator: 'OR',
      filters: [
        { field: 'dealStatus', op: 'IS_NOT', value: '["PAUSED"]' },
        { field: 'dealStatus', op: 'IS_EMPTY', value: '' },
      ],
    });
  else if (filters.status !== 'ALL')
    roots.push({
      field: 'dealStatus',
      op: 'IS',
      value: JSON.stringify([filters.status]),
    });
  // A harmless non-empty criterion also resets previous transient filters on Clear.
  if (!roots.length && !groups.length)
    roots.push({ field: 'id', op: 'IS_NOT_EMPTY', value: '' });
  const flatten = (value: unknown, prefix: string) => {
    if (typeof value === 'string') query[prefix] = value;
    else if (value && typeof value === 'object')
      Object.entries(value).forEach(([key, child]) =>
        flatten(child, `${prefix}[${key}]`),
      );
  };
  flatten(
    { operator: 'AND', filters: roots, ...(groups.length ? { groups } : {}) },
    'filterGroup',
  );
  const created = filters.pipelineId ? 'rdCreatedAt' : 'createdAt';
  const order: Record<string, [string, string]> = {
    nameAsc: ['name', 'ASC'],
    nameDesc: ['name', 'DESC'],
    newest: [created, 'DESC'],
    oldest: [created, 'ASC'],
    nextTask: ['nextActivityAt', 'ASC'],
    closeDate: ['closeDate', 'ASC'],
    lastContact: ['lastContactAt', 'DESC'],
    oldestContact: ['lastContactAt', 'ASC'],
    rating: ['qualification', 'DESC'],
  };
  const [field, direction] = order[filters.sort] ?? order.newest;
  query[`sort[${field}]`] = direction;
  query['sort[id]'] = 'ASC';
  return query;
};
