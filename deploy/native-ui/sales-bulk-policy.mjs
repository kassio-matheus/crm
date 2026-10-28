// Pure policy shared by the pinned native adapter and its behavioral tests.
export const relationIds = (filter, key) => {
  if (!filter || typeof filter !== 'object') return null;
  const own = filter[key];
  if (own?.eq) return [own.eq];
  if (Array.isArray(own?.in)) return own.in;
  if (Array.isArray(filter.and)) {
    const constraints = filter.and
      .map((child) => relationIds(child, key))
      .filter(Boolean);
    return constraints.length
      ? constraints.reduce((a, b) => a.filter((id) => b.includes(id)))
      : null;
  }
  // An OR only constrains a relation if every branch constrains it.
  if (Array.isArray(filter.or)) {
    const branches = filter.or.map((child) => relationIds(child, key));
    return branches.every(Boolean) ? [...new Set(branches.flat())] : null;
  }
  return null;
};

export const phaseScope = (filter, stageId) => {
  if (!/^[\da-f-]{36}$/i.test(stageId)) throw new Error('Invalid stage.');
  // AND preserves every existing owner/status/search predicate, including OR groups.
  return { and: [filter, { salesStageId: { eq: stageId } }] };
};

export const readSnapshot = async (read, filter, fields = 'id') => {
  const rows = new Map(),
    cursors = new Set();
  let after = null;
  do {
    const page = await read({ filter, after, fields });
    if (!page || !Array.isArray(page.edges))
      throw new Error('Incomplete selection response.');
    for (const { node } of page.edges) rows.set(node.id, node);
    if (!page.pageInfo?.hasNextPage) return [...rows.values()];
    const next = page.pageInfo.endCursor;
    if (!next || cursors.has(next) || !page.edges.length)
      throw new Error('Selection pagination did not advance.');
    cursors.add(next);
    after = next;
  } while (true);
};

export const copyDeal = (record, fields, newId) => {
  const copy = { id: newId, name: `${record.name || 'Negociação'} · Cópia` };
  const excluded = new Set([
    'id',
    'name',
    'position',
    'createdAt',
    'updatedAt',
    'deletedAt',
    'createdBy',
    'updatedBy',
    'searchVector',
    'rdSourceKey',
    'rdOriginalData',
    'salesPipelineKey',
    'salesStageKey',
  ]);
  const clean = (value) =>
    Array.isArray(value)
      ? value.map(clean)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .filter(([key]) => key !== '__typename')
              .map(([key, child]) => [key, clean(child)]),
          )
        : value;
  for (const field of fields) {
    if (
      excluded.has(field.name) ||
      field.isUnique ||
      field.isUIEditable === false ||
      !field.isActive
    )
      continue;
    if (['RELATION', 'MORPH_RELATION'].includes(field.type)) {
      if (field.settings?.relationType !== 'MANY_TO_ONE') continue;
      const key = field.settings?.joinColumnName || `${field.name}Id`;
      if (record[key] !== undefined) copy[key] = record[key];
    } else if (record[field.name] !== undefined)
      copy[field.name] = clean(record[field.name]);
  }
  return copy;
};

export const validateMove = (action, pipelineId, stageId, stages) => {
  if (
    !pipelineId ||
    !stageId ||
    !stages.some(
      (stage) => stage.id === stageId && stage.salesPipelineId === pipelineId,
    )
  )
    throw new Error('Escolha uma etapa válida do funil de destino.');
  if (!['pipeline', 'stage'].includes(action)) throw new Error('Invalid move.');
  return { salesPipelineId: pipelineId, salesStageId: stageId };
};

export const printField = (field) => {
  const parts = {
    CURRENCY: 'amountMicros currencyCode',
    FULL_NAME: 'firstName lastName',
    EMAILS: 'primaryEmail additionalEmails',
    LINKS: 'primaryLinkLabel primaryLinkUrl secondaryLinks',
    PHONES:
      'primaryPhoneNumber primaryPhoneCallingCode primaryPhoneCountryCode additionalPhones',
    ADDRESS:
      'addressStreet1 addressStreet2 addressCity addressState addressCountry addressPostcode addressLat addressLng',
    RICH_TEXT: 'blocknote markdown',
  };
  return parts[field.type] ? `${field.name}{${parts[field.type]}}` : field.name;
};

export const stagePickerFilter = (objectName, filters, fields) => {
  if (objectName !== 'salesStage') return undefined;
  const pipelineFields = new Set(
    fields
      .filter((field) => field.name === 'salesPipeline')
      .map((field) => field.id),
  );
  const selected = filters.filter(
    (filter) =>
      pipelineFields.has(filter.fieldMetadataId) && filter.operand === 'IS',
  );
  let ids = null;
  for (const filter of selected) {
    let parsed;
    try {
      parsed = JSON.parse(filter.value);
    } catch {
      return { id: { in: [] } };
    }
    const values = Array.isArray(parsed) ? parsed : parsed?.selectedRecordIds;
    if (!Array.isArray(values)) return { id: { in: [] } };
    ids = ids ? ids.filter((id) => values.includes(id)) : values;
  }
  return ids ? { salesPipelineId: { in: ids } } : { id: { in: [] } };
};

export const assertBatchResult = (records, ids) => {
  const written = new Set(records?.map((record) => record.id));
  if (written.size !== ids.length || ids.some((id) => !written.has(id)))
    throw new Error('The server did not confirm every selected record.');
};

export const isOperationalSalesField = (objectName, fieldName) =>
  objectName !== 'opportunity' ||
  !['stage', 'salesPipelineKey', 'salesStageKey'].includes(fieldName);

export const salesFilterPredicate = (value) => {
  const and = [];
  if (value.pipelineId) and.push({ salesPipelineId: { eq: value.pipelineId } });
  if (value.pipelineId && value.stageId)
    and.push({ salesStageId: { eq: value.stageId } });
  if (value.ownerId)
    and.push({
      ownerId:
        value.ownerId === 'UNASSIGNED' ? { is: 'NULL' } : { eq: value.ownerId },
    });
  if (['ONGOING', 'WON'].includes(value.status))
    and.push({
      or: [
        { dealStatus: { in: [value.status] } },
        {
          and: [
            { dealStatus: { is: 'NULL' } },
            value.status === 'WON'
              ? { stage: { in: ['CUSTOMER'] } }
              : { not: { stage: { in: ['CUSTOMER'] } } },
          ],
        },
      ],
    });
  else if (value.status === 'NOT_PAUSED')
    and.push({
      or: [
        { dealStatus: { is: 'NULL' } },
        { not: { dealStatus: { in: ['PAUSED'] } } },
      ],
    });
  else if (value.status !== 'ALL')
    and.push({ dealStatus: { in: [value.status] } });
  return and.length ? { and } : {};
};

export const salesFilterQuery = (value, listViewId) => {
  const query = {
    viewId:
      value.pipelineId && value.mode === 'board'
        ? value.pipelineId
        : listViewId,
  };
  const filters = [];
  const groups = [];
  const add = (field, id) =>
    filters.push({ field, op: 'IS', value: JSON.stringify([id]) });
  if (value.pipelineId) add('salesPipeline', value.pipelineId);
  if (value.pipelineId && value.stageId) add('salesStage', value.stageId);
  if (value.ownerId === 'UNASSIGNED')
    filters.push({ field: 'owner', op: 'IS_EMPTY', value: '' });
  else if (value.ownerId) add('owner', value.ownerId);
  if (['ONGOING', 'WON'].includes(value.status)) {
    const explicit = {
      field: 'dealStatus',
      op: 'IS',
      value: JSON.stringify([value.status]),
    };
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
          op: value.status === 'WON' ? 'IS' : 'IS_NOT',
          value: '["CUSTOMER"]',
        },
      ],
    });
  } else if (value.status === 'NOT_PAUSED')
    groups.push({
      operator: 'OR',
      filters: [
        { field: 'dealStatus', op: 'IS_NOT', value: '["PAUSED"]' },
        { field: 'dealStatus', op: 'IS_EMPTY', value: '' },
      ],
    });
  else if (value.status !== 'ALL') add('dealStatus', value.status);
  if (!filters.length && !groups.length)
    filters.push({ field: 'id', op: 'IS_NOT_EMPTY', value: '' });
  const flatten = (object, key) => {
    for (const [child, item] of Object.entries(object)) {
      const name = `${key}[${child}]`;
      if (typeof item === 'string') query[name] = item;
      else flatten(item, name);
    }
  };
  flatten(
    { operator: 'AND', filters, ...(groups.length ? { groups } : {}) },
    'filterGroup',
  );
  const created = value.pipelineId ? 'rdCreatedAt' : 'createdAt';
  const sorts = {
    newest: [created, 'DESC'],
    oldest: [created, 'ASC'],
    nameAsc: ['name', 'ASC'],
    nameDesc: ['name', 'DESC'],
    nextTask: ['nextActivityAt', 'ASC'],
    closeDate: ['closeDate', 'ASC'],
    lastContact: ['lastContactAt', 'DESC'],
    oldestContact: ['lastContactAt', 'ASC'],
    rating: ['qualification', 'DESC'],
  };
  const [field, direction] = sorts[value.sort] || sorts.newest;
  query[`sort[${field}]`] = direction;
  query['sort[id]'] = 'ASC';
  return query;
};
