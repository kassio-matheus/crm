import type { ImportState } from 'src/types/import-state';
import type { RdCredentials } from 'src/types/rd-credentials';
import { sourceId } from 'src/utils/source-id.util';
import { recentImportPlan } from 'src/utils/recent-import-plan.util';
import { RECENT_SAMPLE_LIMIT } from 'src/constants/recent-sample-limit';

export const newRecentImport = (
  credentials: RdCredentials,
  previous: ImportState | null,
  scope: 'sample' | 'all',
  dryRun: boolean,
): ImportState => {
  if (credentials.version !== 'v2')
    throw new Error(
      'RD_V2_REQUIRED: recent samples and complete filtered imports require API v2.',
    );
  const now = new Date().toISOString();
  return {
    id:
      scope === 'sample' && !dryRun && previous?.selection?.scope === 'sample'
        ? previous.id
        : sourceId(
            `recent-migration:${credentials.accountKey}:${scope}:${previous?.id ?? 'initial'}:${previous?.revision ?? 0}`,
          ),
    accountKey: credentials.accountKey,
    version: 'v2',
    dryRun,
    status: 'READY',
    phase: 'resources',
    resourceIndex: 0,
    page: 1,
    recordOffset: 0,
    pageSignature: null,
    nextPath: null,
    parentCursor: null,
    parentId: null,
    detailIndex: 0,
    processed: 0,
    created: 0,
    skipped: 0,
    requests: 0,
    retryCount: 0,
    counts: {},
    revision: (previous?.revision ?? 0) + 1,
    jobId: null,
    nextRequestAt: 0,
    error: null,
    startedAt: now,
    updatedAt: now,
    plan: recentImportPlan(scope === 'sample'),
    selection: {
      scope,
      limit:
        scope === 'sample' && !dryRun
          ? previous!.selection!.limit
          : RECENT_SAMPLE_LIMIT,
      cutoff: scope === 'sample' && !dryRun ? previous!.selection!.cutoff : now,
      selectedDeals:
        scope === 'sample' && !dryRun
          ? [...previous!.selection!.selectedDeals]
          : [],
    },
    ...(scope === 'sample' && previous?.preview
      ? {
          preview: { ...previous.preview },
          ...(!dryRun && previous.preview.status === 'REMOVED'
            ? {
                preview: {
                  ...previous.preview,
                  status: 'AVAILABLE',
                  removed: 0,
                  viewsRemoved: 0,
                  viewsChecked: false,
                },
                maintenance: 'restore',
              }
            : {}),
        }
      : scope === 'sample' && !dryRun
        ? {
            preview: {
              runId: previous!.id,
              status: 'AVAILABLE',
              owned: 0,
              removed: 0,
            },
          }
        : scope === 'all' && previous?.preview
          ? {
              preview: { ...previous.preview, status: 'PROMOTED' },
              maintenance: 'restore',
            }
          : {}),
  };
};
