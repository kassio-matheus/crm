import { Tag } from 'twenty-ui/primitives/data-display';
import {
  IconCheck,
  IconPlayerPause,
  IconAlertTriangle,
  IconCircleDot,
  IconClock,
} from 'twenty-ui/icon';
import type { ImportState } from 'src/types/import-state';

export const ImportStatusTag = ({
  state,
  pending,
}: {
  state: ImportState | null;
  pending?: string | null;
}) => {
  const status =
    pending === 'pause'
      ? 'Pausa solicitada'
      : pending
        ? 'Ação solicitada'
        : {
            READY: 'Na fila',
            RUNNING: 'Em andamento',
            PAUSED: 'Pausada',
            FAILED: 'Requer atenção',
            COMPLETED: 'Concluída',
          }[state?.status ?? 'READY'];
  const color =
    state?.status === 'FAILED'
      ? 'red'
      : state?.status === 'PAUSED'
        ? 'orange'
        : state?.status === 'COMPLETED'
          ? 'green'
          : 'blue';
  const Icon =
    state?.status === 'FAILED'
      ? IconAlertTriangle
      : state?.status === 'PAUSED'
        ? IconPlayerPause
        : state?.status === 'COMPLETED'
          ? IconCheck
          : state?.status === 'READY'
            ? IconClock
            : IconCircleDot;
  const tone =
    color === 'red'
      ? 'danger'
      : color === 'orange'
        ? 'warning'
        : color === 'green'
          ? 'success'
          : 'accent';
  return (
    <Tag
      color={color}
      className={`ri-tag ri-tag-${tone}`}
      startIcon={<Icon size={13} aria-hidden />}
    >
      {state ? status : 'Aguardando início'}
    </Tag>
  );
};
