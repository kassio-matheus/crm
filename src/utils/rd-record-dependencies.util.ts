/** Dependencies needed by the native mapper, fetched by ID before a newer deal is created. */
export const rdRecordDependencies = (
  kind: string,
  record: Record<string, unknown>,
): { kind: string; id: string }[] => {
  const output: { kind: string; id: string }[] = [];
  const embedded = (name: string) => {
    const value = record[name] as { id?: unknown; _id?: unknown } | undefined;
    return value?.id ?? value?._id;
  };
  const add = (name: string, id: unknown) => {
    if (typeof id === 'string' && id) {
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id))
        throw new Error('Invalid source reference ID.');
      output.push({ kind: name, id });
    }
  };
  if (['deals', 'contacts'].includes(kind))
    add('organizations', record.organization_id ?? embedded('organization'));
  if (kind === 'deals') {
    const contacts = record.contact_ids as unknown[] | undefined;
    const linked = record.contacts as
      { id?: unknown; _id?: unknown }[] | undefined;
    add('contacts', contacts?.[0] ?? linked?.[0]?.id ?? linked?.[0]?._id);
  }
  if (kind === 'tasks' || kind === 'activities')
    add('deals', record.deal_id ?? embedded('deal'));
  return output;
};
