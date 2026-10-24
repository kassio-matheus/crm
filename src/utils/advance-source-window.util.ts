import type { ImportSelection } from 'src/types/import-selection';

/** Inclusive overlap retains every timestamp tie; dense unpartitionable ties fail closed. */
export const advanceSourceWindow = (
  selection: ImportSelection,
  records: Record<string, unknown>[],
  page: number,
  hasMore: boolean,
): boolean => {
  const upper = selection.upper ?? selection.cutoff;
  let previous = Date.parse(upper);
  if (!Number.isFinite(previous)) throw new Error('RD_INVALID_WINDOW');
  for (const record of records) {
    const at =
      typeof record.created_at === 'string'
        ? Date.parse(record.created_at)
        : NaN;
    if (!Number.isFinite(at) || at > previous)
      throw new Error(
        'RD_SOURCE_ORDER_CHANGED: source dates do not match the requested descending window.',
      );
    previous = at;
  }
  if (!hasMore || page < 399) return false;
  if (!records.length) throw new Error('RD_INVALID_WINDOW');
  const boundary = String(records[records.length - 1].created_at);
  if (Date.parse(boundary) >= Date.parse(upper))
    throw new Error(
      'RD_DENSE_TIMESTAMP_LIMIT: 9,975 or more records share the same source timestamp. The API cannot safely advance this date filter; no records were silently skipped.',
    );
  selection.upper = boundary;
  selection.boundary = boundary;
  return true;
};
