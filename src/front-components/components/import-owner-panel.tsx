import { useState } from 'react';
import { Tag } from 'twenty-ui/primitives/data-display';
import { IconUsers } from 'twenty-ui/icon';
import type { ImportOwnerMatch } from 'src/types/import-owner-match';
import { ImportButton } from './import-button';

export const ImportOwnerPanel = ({
  owners,
  dryRun,
  checkedAt,
}: {
  owners?: Record<string, ImportOwnerMatch>;
  dryRun: boolean;
  checkedAt?: string;
}) => {
  const [expanded, setExpanded] = useState(false);
  const rows = Object.values(owners ?? {});
  const matched = rows.filter((row) => row.status === 'matched').length;
  return (
    <section
      className="ri-card"
      style={{ marginTop: 20 }}
      aria-label="Associação dos proprietários"
    >
      <div className="ri-card-header">
        <h2>
          <IconUsers size={18} aria-hidden /> Proprietários e responsáveis
        </h2>
        <Tag
          color={rows.length && matched === rows.length ? 'green' : 'orange'}
        >
          {rows.length
            ? `${matched}/${rows.length} usuários do RD encontrados no Twenty`
            : 'Aguardando nova simulação'}
        </Tag>
      </div>
      <p className="ri-muted">
        A correspondência usa o e-mail ou um vínculo explícito confirmado pelo
        administrador quando os e-mails são diferentes. Negociações recebem o
        proprietário; empresas, o responsável; tarefas com um único responsável
        recebem o membro correspondente. Contatos mantêm seus vínculos com
        empresas e negociações.
      </p>
      <p className="ri-fine-print">
        {checkedAt
          ? `Conferência atualizada em ${new Date(checkedAt).toLocaleTimeString('pt-BR')}. ${dryRun ? 'A simulação não altera proprietários.' : 'Os vínculos salvos são usados na importação e na repetição de registros sem proprietário.'}`
          : !rows.length
            ? 'Os usuários e suas correspondências aparecerão após a próxima simulação.'
            : dryRun
              ? 'Esta conferência não altera registros. Os vínculos serão refeitos ao criar a amostra.'
              : 'Conferência dos membros desta criação.'}{' '}
        Membros ausentes ou e-mails ambíguos deixam o vínculo vazio, sem
        atribuir a outra pessoa. Tarefas com vários responsáveis no RD mantêm a
        lista no registro de origem, pois o Twenty admite um responsável por
        tarefa. Contas, convites, equipes e permissões de acesso não são criados
        automaticamente.
      </p>
      {rows.length > 0 && (
        <>
          <div className="ri-row" style={{ marginTop: 12 }}>
            <Tag color={matched === rows.length ? 'green' : 'orange'}>
              {rows.length - matched} pendências no catálogo
            </Tag>
            <ImportButton
              size="sm"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded
                ? 'Ocultar correspondências'
                : 'Conferir e-mails e pendências'}
            </ImportButton>
          </div>
          {expanded && (
            <table
              className="ri-resources"
              style={{ marginTop: 12, tableLayout: 'fixed' }}
            >
              <thead>
                <tr>
                  <th>Usuário do RD / e-mail</th>
                  <th>Associação no Twenty</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.sourceId}>
                    <td style={{ overflowWrap: 'anywhere' }}>
                      {row.name || 'Sem nome'}
                      <br />
                      <span className="ri-muted ri-tiny">
                        {row.email || 'Sem e-mail no RD'}
                      </span>
                    </td>
                    <td>
                      <Tag
                        color={row.status === 'matched' ? 'green' : 'orange'}
                      >
                        {row.status === 'matched'
                          ? row.matchMethod === 'explicit'
                            ? 'Vínculo confirmado'
                            : 'E-mail correspondente'
                          : row.status === 'ambiguous'
                            ? 'E-mail ambíguo'
                            : 'Não encontrado'}
                      </Tag>
                      {row.memberId && (
                        <p
                          className="ri-muted ri-tiny"
                          style={{ overflowWrap: 'anywhere' }}
                        >
                          {row.memberName || 'Membro do Twenty'}
                          <br />
                          {row.memberEmail}
                        </p>
                      )}
                      {row.matchMethod === 'explicit' &&
                        row.status !== 'matched' && (
                          <p className="ri-muted ri-tiny">
                            O membro do vínculo salvo não está disponível.
                            Revise a correspondência.
                          </p>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
};
