import type { ImportState } from 'src/types/import-state';
import { rdImportResources } from 'src/utils/rd-import-resources.util';
import { importResourceLabel } from './import-resource-label.util';

/** Category progress is not a percentage of records: the provider supplies no account-wide total. */
export const importDashboard = (state: ImportState | null, now: number) => {
  const paths = rdImportResources(state?.version ?? 'v2');
  const complete = state?.status === 'COMPLETED';
  const resourceIndex = state?.resourceIndex ?? 0;
  const rows = paths.map((path, index) => {
    const kind = path === 'deal_pipelines' ? 'pipelines' : path.split('?')[0];
    const done = Boolean(
      state &&
      (complete || state.phase === 'dealDetails' || index < resourceIndex),
    );
    const current = Boolean(
      state &&
      !complete &&
      state.phase === 'resources' &&
      index === resourceIndex,
    );
    return {
      key: path,
      kind,
      label: importResourceLabel(path),
      count: state?.counts[kind] ?? 0,
      status: done ? 'done' : current ? 'current' : 'waiting',
    };
  });
  const stageDone = Boolean(
    state &&
    (complete ||
      state.phase === 'dealDetails' ||
      (resourceIndex > 0 && state.phase !== 'pipelineDetails')),
  );
  rows.splice(1, 0, {
    key: 'stages',
    kind: 'stages',
    label: 'Etapas dos funis',
    count: state?.counts.stages ?? 0,
    status: stageDone
      ? 'done'
      : state?.phase === 'pipelineDetails'
        ? 'current'
        : 'waiting',
  });
  const done = rows.filter((row) => row.status === 'done').length;
  const current =
    state?.phase === 'pipelineDetails'
      ? 'Etapas dos funis'
      : state?.phase === 'dealDetails'
        ? 'Detalhes das negociações'
        : complete
          ? 'Verificação finalizada'
          : (rows.find((row) => row.status === 'current')?.label ??
            'Aguardando início');
  const end =
    state && ['PAUSED', 'FAILED', 'COMPLETED'].includes(state.status)
      ? Date.parse(state.updatedAt)
      : now;
  const start = Date.parse(state?.startedAt ?? '');
  return {
    rows,
    done,
    total: rows.length,
    percent: Math.round((done / rows.length) * 100),
    current,
    elapsedSeconds:
      Number.isFinite(start) && Number.isFinite(end)
        ? Math.max(0, Math.floor((end - start) / 1000))
        : 0,
    retrySeconds:
      state?.retryCount && state.status === 'RUNNING'
        ? Math.max(0, Math.ceil((state.nextRequestAt - now) / 1000))
        : 0,
    checkpointAge: state
      ? Math.max(0, Math.floor((now - Date.parse(state.updatedAt)) / 1000))
      : 0,
  };
};
