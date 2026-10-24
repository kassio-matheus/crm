# Verificação de importações repetidas

Revisado em 24/10/2026. A proteção já existia no importador; esta revisão acrescentou testes de regressão e documentação, sem mudar os identificadores, o modelo de dados ou o comportamento de produção.

## Como o mesmo registro é reconhecido

A referência de origem combina a chave da companhia, o tipo de dado e o ID do RD. Produtos e arquivos de uma negociação também incluem a negociação de origem nessa referência. O identificador da execução não participa da identidade do registro.

Antes de criar, o importador consulta o comprovante de importação salvo em `rdSourceRecords`. Um comprovante concluído faz o registro ser preservado. A criação também usa um ID de destino estável e campos de referência únicos no banco, impedindo uma segunda linha com a mesma identidade. Se a execução falhar depois de criar o registro, mas antes de concluir o comprovante, a retomada encontra o destino existente e completa a referência sem sobrescrever os dados.

Tarefas e notas usam IDs estáveis também para seus vínculos. Arquivos existentes são reconhecidos antes de baixar ou enviar outra cópia. Uma disputa entre duas tentativas pode interromper uma delas pela restrição de unicidade; a retomada reaproveita o resultado persistido.

## O que a proteção não faz

- Um novo cadastro no RD com outro ID é um registro distinto, mesmo que tenha o mesmo nome, domínio ou telefone.
- Cadastros feitos manualmente no Twenty não são associados automaticamente por semelhança. Conflitos de e-mail principal em contatos interrompem o processo para revisão.
- A importação preserva registros já trazidos e alterações feitas no Twenty; não atualiza esses registros com mudanças posteriores do RD.
- O sistema mantém uma migração por workspace. Depois de concluída uma importação real, repetir os comandos não inicia outro ciclo. Uma migração em andamento continua do checkpoint. A companhia e a versão da API ficam fixas.
- O envio de um arquivo interrompido antes de salvar seu recibo pode deixar um arquivo de armazenamento sem vínculo. Isso não cria outra negociação ou outro registro de anexo.

## Evidências desta revisão

Os 40 testes direcionados dos serviços de registros, anexos e controle passaram. Os novos casos verificam empresas, contatos, negociações, tarefas e notas repetidos com identificadores de execução diferentes, preservação de alterações locais, recuperação depois de uma criação parcialmente confirmada, concorrência, separação entre companhias/IDs distintos, conflito de e-mail, anexos já existentes e bloqueio de reinício de uma importação real concluída.

Typecheck e lint passaram sem erros. Os novos testes usam um destino simulado com persistência entre chamadas e restrição de chave primária; não são uma nova execução contra o PostgreSQL de produção. Nenhuma importação, criação de dados de negócio ou alteração no RD foi iniciada nesta revisão.

O plano somente de leitura do workspace de produção não apontou diferenças: zero criações, atualizações ou exclusões. As definições de proteção já estão sincronizadas; não foi necessário publicar uma mudança de execução.
