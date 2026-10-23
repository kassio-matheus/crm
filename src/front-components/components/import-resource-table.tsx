import { useState } from 'react';
import { Input } from 'twenty-ui/primitives/input';
import { Tag } from 'twenty-ui/primitives/data-display';
import {
  IconSearch,
  IconCheck,
  IconCircleDot,
  IconCircleDashed,
} from 'twenty-ui/icon';
import { ImportButton } from './import-button';
import type { importDashboard } from '../utils/import-dashboard.util';
import type { ImportState } from 'src/types/import-state';

export const ImportResourceTable = ({
  model,
  state,
}: {
  model: ReturnType<typeof importDashboard>;
  state: ImportState | null;
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const rows = model.rows.filter(
    (row) =>
      row.label
        .toLocaleLowerCase('pt-BR')
        .includes(search.toLocaleLowerCase('pt-BR')) &&
      (filter === 'all' || row.status === filter),
  );
  return (
    <section className="ri-card" aria-label="Progresso por tipo de dado">
      <div className="ri-card-header">
        <div>
          <h2>O que está sendo verificado</h2>
          <p className="ri-muted ri-tiny">
            Contadores atualizados a partir do checkpoint salvo.
          </p>
        </div>
        <Tag color="transparent" className="ri-tag">
          {model.done}/{model.total} etapas lidas
        </Tag>
      </div>
      <div className="ri-search">
        <IconSearch size={16} className="ri-muted" aria-hidden />
        <Input
          className="ri-input"
          aria-label="Buscar tipo de dado"
          placeholder="Buscar empresas, contatos, negociações…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div
        className="ri-row"
        style={{ gap: 6, marginBottom: 14 }}
        aria-label="Filtrar etapas"
      >
        {[
          ['all', 'Todas'],
          ['current', 'Etapa atual'],
          ['done', 'Concluídas'],
        ].map(([value, label]) => (
          <ImportButton
            key={value}
            size="sm"
            aria-pressed={filter === value}
            emphasis={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </ImportButton>
        ))}
      </div>
      <table className="ri-resources">
        <thead>
          <tr>
            <th style={{ width: '49%' }}>Tipo de dado</th>
            <th style={{ width: '19%', textAlign: 'right' }}>Verificados</th>
            <th style={{ width: '32%' }}>Situação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const done = row.status === 'done';
            const current = row.status === 'current';
            const Icon = done
              ? IconCheck
              : current
                ? IconCircleDot
                : IconCircleDashed;
            const paused = current && state?.status === 'PAUSED';
            const failed = current && state?.status === 'FAILED';
            return (
              <tr
                key={row.key}
                className={current ? 'ri-resource-current' : ''}
              >
                <td>
                  <div className="ri-resource-name">
                    <Icon
                      size={14}
                      style={{
                        flexShrink: 0,
                        color: done
                          ? 'var(--ri-green)'
                          : current
                            ? 'var(--ri-accent)'
                            : 'var(--ri-muted)',
                      }}
                      aria-hidden
                    />
                    <span>{row.label}</span>
                  </div>
                </td>
                <td className="ri-count">
                  {row.count.toLocaleString('pt-BR')}
                </td>
                <td>
                  <Tag
                    color={
                      done
                        ? 'green'
                        : failed
                          ? 'red'
                          : paused
                            ? 'orange'
                            : current
                              ? 'blue'
                              : 'transparent'
                    }
                    className={`ri-tag ${done ? 'ri-tag-success' : failed ? 'ri-tag-danger' : paused ? 'ri-tag-warning' : current ? 'ri-tag-accent' : ''}`}
                  >
                    {done
                      ? 'Lida'
                      : failed
                        ? 'Revisar'
                        : paused
                          ? 'Pausada'
                          : current
                            ? 'Em leitura'
                            : 'Aguardando'}
                  </Tag>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!rows.length && (
        <div className="ri-empty">
          <IconSearch size={24} />
          <p>Nenhuma etapa encontrada para esse filtro.</p>
          <ImportButton
            onClick={() => {
              setSearch('');
              setFilter('all');
            }}
          >
            Limpar filtros
          </ImportButton>
        </div>
      )}
      <p className="ri-fine-print" style={{ marginTop: 14 }}>
        Os totais são acumulados por tipo de dado. Etapas vazias também são
        consideradas lidas. O RD não informa um total global de registros.
      </p>
    </section>
  );
};
