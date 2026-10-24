/** Whitelist: cleanup can only address native objects created by this importer. */
export const importNativeTarget = (table: string) => {
  const names: Record<string, string> = {
    companies: 'Company',
    people: 'Person',
    opportunities: 'Opportunity',
    tasks: 'Task',
    notes: 'Note',
    taskTargets: 'TaskTarget',
    noteTargets: 'NoteTarget',
    attachments: 'Attachment',
    salesPipelines: 'SalesPipeline',
    salesStages: 'SalesStage',
  };
  const singular = names[table];
  if (!singular) throw new Error('RD_INVALID_PREVIEW_TARGET');
  return {
    table,
    create: `create${singular}`,
    remove: `delete${singular}`,
    restore: `restore${singular}`,
    keyField: ['salesPipelines', 'salesStages'].includes(table)
      ? 'sourceKey'
      : ['companies', 'people', 'opportunities', 'tasks', 'notes'].includes(
            table,
          )
        ? 'rdSourceKey'
        : null,
  };
};
