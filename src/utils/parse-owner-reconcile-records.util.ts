import type { ImportOwnerReconcileRecord } from 'src/types/import-owner-reconcile-record';

export const parseOwnerReconcileRecords = (
  payload: unknown,
): ImportOwnerReconcileRecord[] => {
  const rows = (payload as { records?: unknown } | null)?.records;
  if (!Array.isArray(rows) || !rows.length || rows.length > 50)
    throw new Error(
      'RD_OWNER_RECONCILE_INPUT: provide between 1 and 50 imported records.',
    );
  const unique = new Map<string, ImportOwnerReconcileRecord>();
  for (const row of rows) {
    if (
      !row ||
      typeof row.id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[4-9a-f][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        row.id,
      ) ||
      !['deals', 'organizations', 'tasks'].includes(row.kind)
    )
      throw new Error(
        'RD_OWNER_RECONCILE_INPUT: invalid imported record identity.',
      );
    unique.set(`${row.kind}:${row.id}`, { id: row.id, kind: row.kind });
  }
  return [...unique.values()];
};
