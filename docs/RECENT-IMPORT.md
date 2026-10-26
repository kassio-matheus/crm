# Teste recente e importação completa

## Fluxo da página

1. **Simular dados recentes:** lê até 125 negociações em ordem de criação decrescente, usando uma data de corte fixa. Busca por ID as empresas e o contato principal necessários, mesmo quando são antigos. Verifica os valores projetados e conflitos de e-mail sem criar dados operacionais.
2. **Criar amostra no Twenty:** cria exatamente os IDs de negociação verificados, seus vínculos, funis, etapas e campos personalizados nativos. Inclui uma amostra de até cinco tarefas por negociação. Isso não representa validação de toda a base, de todos os anexos ou do histórico antigo.
3. **Excluir dados da amostra:** opcionalmente envia à lixeira apenas os registros operacionais novos identificados pelo teste. As visualizações canônicas dos funis criados pelo teste também são removidas, com a configuração guardada para restauração. O histórico técnico, snapshots e comprovantes são mantidos para auditoria e recuperação. Não há destroy/purge. Registros anteriores não são associados à amostra por nome ou semelhança.
4. **Importar tudo de vez:** ação separada, com conferência do backup e confirmação no diálogo do Twenty. Percorre todos os recursos acessíveis pela API, priorizando as negociações recentes e buscando suas referências conforme necessário. A amostra é incorporada sem duplicações; se tiver sido enviada à lixeira pelo botão, seus registros são restaurados antes da leitura completa. A exclusão de teste fica desativada depois dessa promoção.

## Ampliar a amostra e associar proprietários

A amostra passou de 25 para **125 negociações**. As páginas da API continuam com 25 registros e as tarefas continuam limitadas a cinco por negociação, totalizando até 625 tarefas quando disponíveis. Contatos e empresas são trazidos conforme os vínculos das negociações; sua quantidade não é fixa. Uma simulação antiga mantém seu limite e sua seleção até uma nova simulação explícita.

1. Cadastre os membros no Twenty com o **mesmo e-mail do RD**, conclua os convites e peça que aceitem antes de simular.
2. Use **Simular dados recentes** novamente. O painel **Proprietários e responsáveis** compara o catálogo de usuários do RD aos membros existentes e mostra os encontrados, ausentes e ambíguos. Os totais representam o catálogo lido, não a quantidade de negociações atribuídas.
3. Confira as pendências e use **Criar amostra no Twenty**. A criação relê o catálogo e os membros; usa o e-mail atual, ignorando maiúsculas e espaços nas pontas. Nenhuma conta, equipe, convite ou permissão é criada.

Negociações recebem `ownerId`; empresas recebem `accountOwnerId`; tarefas recebem `assigneeId` quando há exatamente um responsável no RD. Contatos preservam as relações com empresas e negociações. Tarefas com vários responsáveis mantêm todos no snapshot original; o Twenty admite apenas um responsável por tarefa e o importador não escolhe arbitrariamente um deles.

Na repetição, somente o vínculo de proprietário **vazio** pode ser preenchido, sempre pelo ID determinístico e pela referência exata de origem. A condição de vazio é verificada na mesma operação do banco que escreve o vínculo, protegendo uma atribuição manual concorrente. Proprietários já definidos e os demais campos permanecem preservados. E-mail ausente, sem membro correspondente ou ambíguo deixa o vínculo vazio para revisão; nunca usa nomes como alternativa.

Uma nova simulação preserva os comprovantes de propriedade da amostra anterior. A criação ampliada reaproveita esses registros e adiciona os novos ao mesmo conjunto de exclusão. Se a amostra tinha sido excluída pelo botão, ela é restaurada antes da criação ampliada. A importação completa continua sendo uma ação separada; após sua conclusão não há sincronização recorrente automática.

## Além de 10.000 registros

A [API v2 limita as listagens de empresas, contatos e negociações a 10.000 resultados por filtro](https://developers.rdstation.com/reference/crm-v2-introduction). O importador usa os filtros documentados de `created_at` e ordenação decrescente. Ao concluir a página 399 de 25 registros, se houver continuação, guarda a menor data dessa página como novo limite superior inclusivo e recomeça na página 1. A sobreposição retém todos os registros empatados na data de fronteira; os IDs determinísticos e comprovantes impedem outra criação.

Não usa um limite global de registros no modo completo. O limite de 125 negociações pertence somente à amostra. Catálogos necessários são lidos primeiro, as negociações vêm antes da varredura das empresas e contatos sem vínculo já buscado, e os detalhes completos são percorridos na etapa própria. As demais entidades usam as ordenações disponíveis em sua API, como atualização decrescente para tarefas.

Se a janela inteira contiver registros com a mesma data e não puder diminuir o limite superior, o processo para com `RD_DENSE_TIMESTAMP_LIMIT`. Nunca avança subtraindo um segundo ou um milissegundo, pois isso poderia descartar empates não lidos. Esse caso requer uma divisão adicional específica da base. Datas inválidas, respostas fora da ordenação solicitada e links que removam ou alterem os filtros também interrompem a execução.

O limite temporal exibido corresponde ao início da execução. A API não oferece um snapshot transacional: alterações ou criações posteriores no RD exigem reconciliação. O sucesso do teste recente não garante a validade de registros antigos.

## Proteção da exclusão

O teste grava um comprovante técnico de propriedade **antes** de cada criação nativa, usando seu identificador de execução e o ID exato de destino. Registros encontrados previamente não recebem essa propriedade. Isso também cobre falhas após criar o registro e antes de confirmar seu snapshot.

Antes da primeira exclusão, o sistema verifica as referências externas conhecidas de empresas, contatos, negociações, tarefas, notas e catálogos. Se algum registro fora da amostra depender deles, interrompe a remoção para revisão. Se a referência de origem tiver sido alterada, também interrompe. O diálogo avisa que mudanças feitas nos próprios registros da amostra são incluídas na exclusão.

Os registros são removidos em ordem de dependência: anexos/vínculos, tarefas/notas, negociações, contatos, empresas, etapas e funis. A restauração faz a ordem inversa. O estado de remoção é persistido antes de cada soft delete, permitindo recuperar uma interrupção. A função administrativa não recebe IDs arbitrários para excluir: consulta os comprovantes da amostra do próprio checkpoint.

## Segurança e compatibilidade

- RD continua somente leitura: GET para dados e POST exclusivamente no endpoint fixo de tokens OAuth.
- As leituras adicionais de referências participam do mesmo orçamento persistido, com ao menos 800 ms entre requisições e tratamento de Retry-After.
- Nenhum ID de entidade foi trocado e nenhum objeto/campo foi removido. O plano recente é explícito no JSON do checkpoint; os índices legados não são reinterpretados.
- Mudanças explícitas de escopo preservam o checkpoint anterior em um registro técnico de auditoria.
- Uma chave única por checkpoint escolhe uma única proposta de mudança de escopo. Comandos concorrentes compartilham essa proposta e um slot fixo na fila; somente o worker inicializa o novo estado. Reexecuções não reinicializam um checkpoint que já avançou. Há até quatro slots de tentativa para falhas anteriores à inicialização, sem apagar o checkpoint anterior.
- Novos fluxos exigem API v2. Checkpoints legados continuam legíveis e retomáveis nas condições anteriores.
- A função de fundo aceita até 900 segundos para uma página com referências; pausa e recuperação continuam nos limites de checkpoint. Fechar o navegador não para a fila.

## Validação

Os testes cobrem os filtros decrescentes e sua preservação nos cursores, mais de 10.000 registros sintéticos com empates, datas inválidas, timestamps densos, referências por ID, amostra congelada, retomada parcial, propriedade persistida antes da criação, exclusão bloqueada por vínculos externos, soft delete/restauração e promoção da amostra para o fluxo completo. Os testes contra banco usam somente localhost:2021 e fixtures isoladas, sem chamadas reais ao RD.

Revisão de 24/10/2026:

- 329 testes unitários passaram, incluindo comandos concorrentes, slots fixos de recuperação e confirmação do novo escopo no painel. Typecheck e lint passaram sem erros ou avisos de lint.
- 14 testes de integração existentes e dois novos cenários passaram contra o servidor isolado Twenty 2.51.0: propriedade/bloqueio por vínculo externo/exclusão/restauração e unicidade real de uma proposta de escopo com inicialização sem reiniciar progresso. A produção continua no Twenty 2.50.1; não houve atualização do servidor de produção.
- A simulação real recente concluiu com 25 negociações, 25 contatos relacionados e cinco empresas relacionadas, além dos catálogos. Zero registros operacionais foram criados nessa etapa.
- A criação real da mesma amostra concluiu sem erro: 25 negociações, 25 contatos, cinco empresas, seis funis e 32 etapas. São 93 registros operacionais rastreados para remoção. As consultas de tarefas dessas negociações retornaram vazias.
- As 25 negociações têm contato principal, funil e etapa. O Kanban nativo de um dos funis mostrou suas cinco colunas, incluindo as vazias, e os cartões importados.
- O diálogo de exclusão foi aberto e cancelado em produção, preservando a amostra para revisão. Exclusão e restauração efetivas foram exercitadas somente com fixtures no banco isolado.
- A importação completa não foi iniciada. O avanço além de 10.000 foi exercitado com dados sintéticos; a conta inteira ainda depende da ação explícita do administrador e de sua reconciliação.
- A sincronização inicial teve zero criações/exclusões de metadados e 13 atualizações: controles/worker, UI e as permissões necessárias de soft delete. Os ajustes posteriores atualizaram somente funções e a UI, também sem exclusões. Nenhuma alteração foi feita no RD.

### Validação da ampliação para 125

- 355 testes unitários passaram; o caso de cinco páginas congela exatamente 125 IDs e não segue para a página seguinte. Também há cobertura de e-mails normalizados, ausentes/ambíguos, responsáveis V2, referência de companhia e preservação do conjunto de exclusão ao ampliar.
- Um teste de integração no Twenty isolado em `127.0.0.1:2021` passou: criação com proprietário, preenchimento de proprietário vazio na repetição, preservação de nome/proprietário manual e dos comprovantes de exclusão.
- Typecheck e lint passaram. A simulação de 125 foi executada posteriormente no painel. A amostra criada foi conferida com 125 negociações, 125 contatos e cinco empresas, além de seis funis e 32 etapas, e depois foi excluída pelo administrador. A validação observada não representa uma importação completa da base.


## Visualizações na exclusão da amostra

O rastreamento agora inclui a visualização canônica de cada funil novo da amostra. O comprovante é gravado antes de criar o funil, cobrindo a criação concorrente da visualização por eventos do catálogo. A exclusão guarda campos, grupos, filtros, ordenação e configuração da visualização antes de removê-la. A restauração da amostra ou sua promoção à base completa recria essa configuração antes dos registros do funil.

Visualizações preexistentes e aliases criados pelo usuário são preservados. Para amostras antigas, só é adotada uma visualização com o ID canônico do funil comprovadamente criado pela amostra, ícone de bloqueio e filtro determinístico para aquele funil. Não há seleção por nome.

Se a amostra já aparece como excluída, **Concluir limpeza da amostra** executa apenas a correção das visualizações remanescentes. Não exclui nem restaura registros operacionais novamente. Um funil da amostra restaurado manualmente bloqueia essa correção para revisão. O painel registra a quantidade de visualizações removidas. Depois da correção, a opção fica desativada.

A restauração mantém as colunas das etapas e oculta os placeholders de itens sem etapa que o próprio Twenty pode criar ao reconstruir o Kanban. Campos personalizados são estrutura compartilhada e não são removidos junto da amostra.

### Verificação final da limpeza

O teste de integração passou também pelo reparo de uma visualização órfã com o funil já na lixeira: o worker concluiu com zero requisições ao RD e manteve o funil inativo. A execução tem despacho explícito para `cleanup`, `cleanupViews` e `restore`; operações desconhecidas falham sem restaurar registros.

Na correção de produção, um primeiro caminho de manutenção reativou temporariamente a amostra. A rota foi corrigida e ganhou testes unitários e de integração. Os 293 registros do grupo foram devolvidos à lixeira, as seis visualizações canônicas foram removidas e as consultas finais confirmaram zero empresas, pessoas, negociações, funis e etapas importados ativos. As duas visualizações gerais do Kanban foram preservadas. Nenhuma alteração foi enviada aos dados do RD.

A validação final teve 389 testes unitários, os testes de integração de personalizados e de exclusão/restauração de visualizações, typecheck e lint sem erros. Nenhuma importação completa foi iniciada.
