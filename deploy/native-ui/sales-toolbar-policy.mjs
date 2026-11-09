import { salesStatusCriteria } from './sales-bulk-policy.mjs';

export const selectedRelationIds = (value) => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : parsed?.selectedRecordIds || [];
  } catch {
    return [];
  }
};

export const salesQuickScope = (filters, groups, fields) => {
  const fieldNames = new Map(fields.map((field) => [field.id, field.name]));
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const conjunctive = (groupId) => {
    const visited = new Set();
    while (groupId) {
      const group = groupsById.get(groupId);
      if (group?.logicalOperator !== 'AND' || visited.has(groupId))
        return false;
      visited.add(groupId);
      groupId = group.parentRecordFilterGroupId;
    }
    return true;
  };
  const forField = (name) =>
    filters.filter(
      (filter) =>
        fieldNames.get(filter.fieldMetadataId) === name &&
        conjunctive(filter.recordFilterGroupId),
    );
  const canonical = (items) =>
    items
      .map(({ field, op, value }) => JSON.stringify([field, op, value]))
      .sort()
      .join('\n');
  const candidates = groups.filter(
    (group) =>
      group.logicalOperator === 'OR' &&
      conjunctive(group.parentRecordFilterGroupId) &&
      !groups.some((child) => child.parentRecordFilterGroupId === group.id),
  );
  const statusFilters = forField('dealStatus');
  const statuses = ['ONGOING', 'WON', 'NOT_PAUSED'];
  for (const status of statuses) {
    const templates = salesStatusCriteria(status).groups;
    const matches = templates.map((template) =>
      candidates.find(
        (group) =>
          canonical(template.filters) ===
          canonical(
            filters
              .filter((filter) => filter.recordFilterGroupId === group.id)
              .map((filter) => ({
                field: fieldNames.get(filter.fieldMetadataId),
                op: filter.operand,
                value: filter.value,
              })),
          ),
      ),
    );
    if (matches.every(Boolean)) {
      return {
        ownerFilters: forField('owner'),
        statusFilters,
        statusGroupIds: matches.map((group) => group.id),
        status,
      };
    }
  }
  const explicitStatus = statusFilters.find(
    (filter) => filter.operand === 'IS',
  );
  return {
    ownerFilters: forField('owner'),
    statusFilters,
    statusGroupIds: [],
    status: selectedRelationIds(explicitStatus?.value)[0] || 'ALL',
  };
};

export const replaceSalesQuickFilters = ({
  filters,
  groups,
  removeFilters,
  removeGroups,
  added,
  newId,
}) => {
  const removed = new Set(removeGroups);
  const filterIds = new Set(removeFilters.map(({ id }) => id));
  const remaining = filters.filter(
    (filter) =>
      !filterIds.has(filter.id) && !removed.has(filter.recordFilterGroupId),
  );
  // Prune only ancestors emptied by this edit, leaving unrelated advanced rules intact.
  const touched = new Set([
    ...removeFilters.map((filter) => filter.recordFilterGroupId),
    ...groups
      .filter((group) => removed.has(group.id))
      .map((group) => group.parentRecordFilterGroupId),
  ]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const group of groups) {
      if (!touched.has(group.id) || removed.has(group.id)) continue;
      if (remaining.some((filter) => filter.recordFilterGroupId === group.id))
        continue;
      if (
        groups.some(
          (child) =>
            child.parentRecordFilterGroupId === group.id &&
            !removed.has(child.id),
        )
      )
        continue;
      removed.add(group.id);
      touched.add(group.parentRecordFilterGroupId);
      changed = true;
    }
  }
  const kept = groups.filter((group) => !removed.has(group.id));
  const nextFilters = [...remaining, ...added.recordFilters];
  const nextGroups = [...kept, ...added.recordFilterGroups];
  const roots = nextGroups.filter((group) => !group.parentRecordFilterGroupId);
  if (roots.length <= 1) return { filters: nextFilters, groups: nextGroups };
  const rootId = newId();
  const positions = new Map(roots.map(({ id }, index) => [id, index]));
  return {
    filters: nextFilters,
    groups: [
      ...nextGroups.map((group) =>
        positions.has(group.id)
          ? {
              ...group,
              parentRecordFilterGroupId: rootId,
              positionInRecordFilterGroup: positions.get(group.id),
            }
          : group,
      ),
      { id: rootId, logicalOperator: 'AND', positionInRecordFilterGroup: 0 },
    ],
  };
};

export const persistSalesViewOrder = async (
  views,
  move,
  lock,
  update,
  reorder,
) => {
  const fromIndex = move.source.index;
  const toIndex = move.destination?.index;
  if (lock.current || toIndex == null || fromIndex === toIndex) return;
  lock.current = true;
  try {
    const ordered = reorder(views, { fromIndex, toIndex });
    for (const [position, view] of ordered.entries()) {
      if (view.position === position) continue;
      const result = await update({ id: view.id, input: { position } });
      if (result.status !== 'successful') break;
    }
  } finally {
    lock.current = false;
  }
};
