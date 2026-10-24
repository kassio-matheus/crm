import type { ImportState } from 'src/types/import-state';
import type { ImportActivity } from 'src/types/import-activity';

/** Bounded operational history. Never accept records, URLs, credentials or foreign messages. */
export const appendImportActivity = (
  state: ImportState,
  event: ImportActivity['event'],
  detail: Pick<
    ImportActivity,
    'kind' | 'batchSize' | 'durationMs' | 'retryAfterMs'
  > = {},
  now = Date.now(),
): void => {
  const entry: ImportActivity = {
    id: `${state.revision}:${state.requests}:${event}:${state.processed}`,
    at: new Date(now).toISOString(),
    event,
    page: state.page,
    processed: state.processed,
    created: state.created,
    dryRun: state.dryRun,
    kind: detail.kind,
    batchSize: detail.batchSize,
    durationMs: detail.durationMs,
    retryAfterMs: detail.retryAfterMs,
  };
  state.activity = [
    ...(state.activity ?? []).filter((item) => item.id !== entry.id),
    entry,
  ].slice(-40);
};
