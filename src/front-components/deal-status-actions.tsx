import { useEffect, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import {
  useSelectedRecordIds,
  enqueueSnackbar,
} from 'twenty-sdk/front-component';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { Button } from 'twenty-ui/primitives/input';
import {
  IconCheck,
  IconX,
  IconPlayerPause,
  IconPlayerPlay,
} from 'twenty-ui/icon';
import { useTheme } from 'twenty-ui/theme';
import { updateDealStatus } from 'src/front-components/utils/update-deal-status.util';

const DealStatusActions = () => {
  const theme = useTheme();
  const ids = useSelectedRecordIds();
  const id = ids.length === 1 ? ids[0] : null;
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    if (!id) {
      setLoading(false);
      return;
    }
    new CoreApiClient()
      .query({
        opportunity: {
          __args: { filter: { id: { eq: id } } },
          dealStatus: true,
          stage: true,
        },
      })
      .then((r) => {
        if (active)
          setStatus(
            r.opportunity?.dealStatus ||
              (r.opportunity?.stage === 'CUSTOMER' ? 'WON' : 'ONGOING'),
          );
      })
      .catch(() => {
        if (active)
          setError(
            'Não foi possível carregar o status. Reabra a negociação para tentar novamente.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);
  const change = async (next: 'WON' | 'LOST' | 'PAUSED' | 'ONGOING') => {
    if (!id || busy) return;
    setBusy(true);
    setError('');
    try {
      await updateDealStatus(id, next);
      setStatus(next);
      await enqueueSnackbar({
        message:
          next === 'WON'
            ? 'Negociação marcada como vendida.'
            : next === 'LOST'
              ? 'Negociação marcada como perdida.'
              : next === 'PAUSED'
                ? 'Negociação pausada.'
                : 'Negociação retomada.',
        variant: 'success',
      });
    } catch {
      setError('Não foi possível salvar o status. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };
  const paused = status === 'PAUSED';
  const label =
    status === 'WON'
      ? '✓ Vendido'
      : status === 'LOST'
        ? '✕ Perdido'
        : paused
          ? 'Ⅱ Pausado'
          : '▶ Em andamento';
  return (
    <section
      aria-label="Ações da negociação"
      style={{ padding: theme.spacing[3], color: theme.font.color.primary }}
    >
      <p
        role="status"
        style={{ marginTop: 0, color: theme.font.color.secondary }}
      >
        {loading ? 'Carregando status…' : label}
      </p>
      <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
        {(
          [
            { value: 'LOST', label: 'Marcar perda', Icon: IconX },
            { value: 'WON', label: 'Marcar venda', Icon: IconCheck },
            {
              value: paused ? 'ONGOING' : 'PAUSED',
              label: paused ? 'Retomar' : 'Pausar',
              Icon: paused ? IconPlayerPlay : IconPlayerPause,
            },
          ] as const
        ).map((action) => (
          <Button
            key={action.value}
            variant="outline"
            disabled={!id || loading || busy || status === action.value}
            onClick={() => void change(action.value)}
            aria-label={action.label}
            startIcon={<action.Icon size={16} />}
            style={{
              minHeight: 32,
              display: 'inline-flex',
              alignItems: 'center',
              gap: theme.spacing[1],
              padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
              border: `1px solid ${theme.border.color.medium}`,
              borderRadius: theme.border.radius.sm,
              background: theme.background.primary,
              color: theme.font.color.primary,
            }}
          >
            {action.label}
          </Button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
};
export default defineFrontComponent({
  universalIdentifier: '9587b472-567f-4502-862b-7443b053f79e',
  name: 'deal-status-actions',
  description:
    'Direct native-style won, lost, pause and resume actions without moving the pipeline stage.',
  component: DealStatusActions,
});
