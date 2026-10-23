import { useState } from 'react';
import { Input } from 'twenty-ui/primitives/input';
import { Tag } from 'twenty-ui/primitives/data-display';
import {
  IconTimelineEvent,
  IconCheck,
  IconPlayerPause,
  IconPlayerPlay,
  IconRefresh,
  IconAlertTriangle,
  IconSearch,
} from 'twenty-ui/icon';
import type { ImportState } from 'src/types/import-state';
import { importResourceLabel } from '../utils/import-resource-label.util';

export const ImportActivityPanel = ({
  state,
  compact = false,
}: {
  state: ImportState | null;
  compact?: boolean;
}) => {
  const [search, setSearch] = useState('');
  const events = [...(state?.activity ?? [])]
    .reverse()
    .filter(
      (event) =>
        !search ||
        `${importResourceLabel(event.kind ?? '')} ${event.event}`
          .toLocaleLowerCase('pt-BR')
          .includes(search.toLocaleLowerCase('pt-BR')),
    )
    .slice(0, compact ? 5 : 40);
  const titles = {
    page: 'Página verificada',
    paused: 'Processamento pausado',
    resumed: 'Retomada recebida',
    retry: 'Nova tentativa agendada',
    failed: 'Processamento interrompido',
    completed: 'Processamento concluído',
  };
  return (
    <section className="ri-card" aria-label="Atividade da importação">
      <div className="ri-card-header">
        <div>
          <h2>Atividade recente</h2>
          <p className="ri-muted ri-tiny">
            Operações confirmadas pelo servidor.
          </p>
        </div>
        <IconTimelineEvent size={18} className="ri-muted" aria-hidden />
      </div>
      {!compact && (
        <div className="ri-search">
          <IconSearch size={16} className="ri-muted" aria-hidden />
          <Input
            className="ri-input"
            aria-label="Filtrar atividade por tipo de dado"
            placeholder="Filtrar por empresas, contatos…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      )}
      <div className="ri-activity">
        {events.map((event) => {
          const Icon =
            event.event === 'paused'
              ? IconPlayerPause
              : event.event === 'resumed'
                ? IconPlayerPlay
                : event.event === 'retry'
                  ? IconRefresh
                  : event.event === 'failed'
                    ? IconAlertTriangle
                    : IconCheck;
          return (
            <article className="ri-event" key={event.id}>
              <span
                className="ri-event-icon"
                style={{
                  color:
                    event.event === 'failed'
                      ? 'var(--ri-red)'
                      : event.event === 'page' || event.event === 'completed'
                        ? 'var(--ri-green)'
                        : undefined,
                }}
              >
                <Icon size={14} aria-hidden />
              </span>
              <div>
                <div className="ri-event-title">
                  {event.event === 'page'
                    ? `${importResourceLabel(event.kind ?? '')} · página ${event.page}`
                    : titles[event.event]}
                </div>
                <div className="ri-event-meta">
                  {event.event === 'page'
                    ? `${event.batchSize ?? 0} registros retornados pelo RD${event.durationMs !== undefined ? ` · ${event.durationMs.toLocaleString('pt-BR')} ms de resposta` : ''}`
                    : event.event === 'retry'
                      ? `Aguarda ${Math.ceil((event.retryAfterMs ?? 0) / 1000)}s antes da próxima tentativa`
                      : `${event.processed.toLocaleString('pt-BR')} registros processados`}
                </div>
                {!compact && (
                  <div className="ri-row" style={{ marginTop: 7 }}>
                    <Tag color="transparent" className="ri-tag">
                      {event.dryRun ? 'Simulação' : 'Importação'}
                    </Tag>
                    <span className="ri-event-meta">
                      {event.created.toLocaleString('pt-BR')} criados no Twenty
                    </span>
                  </div>
                )}
              </div>
              <time
                className="ri-muted ri-tiny ri-number"
                dateTime={event.at}
                title={new Date(event.at).toLocaleString('pt-BR')}
              >
                {new Date(event.at).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </time>
            </article>
          );
        })}
      </div>
      {!events.length && (
        <div
          className="ri-empty"
          style={{ padding: compact ? '20px 0' : '40px 20px' }}
        >
          <IconTimelineEvent size={26} />
          <p>
            {search
              ? 'Nenhuma atividade encontrada.'
              : 'Os próximos lotes aparecerão aqui.'}
          </p>
          <p className="ri-tiny">
            O histórico detalhado começa com esta versão do painel. Os
            contadores e checkpoints anteriores foram preservados.
          </p>
        </div>
      )}
      <p className="ri-fine-print" style={{ marginTop: 14 }}>
        Últimas {compact ? '5' : '40'} operações registradas. Sem nomes de
        clientes, credenciais ou conteúdo dos registros.
      </p>
    </section>
  );
};
