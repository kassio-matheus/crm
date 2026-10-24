# Central de importação RD Station

A página **Importar do RD Station** mantém o componente e a navegação existentes do Twenty. A central usa abas, botões, tags, campos, confirmação e controles de progresso do Twenty UI, com estilos limitados à própria página e tokens do tema do workspace.

## Acompanhamento

- **Visão geral:** modo atual, situação da execução, etapa e página do checkpoint, contadores de registros, requisições e tempo desde o início. A tabela permite buscar tipos de dados e filtrar a etapa atual ou as concluídas.
- **Atividade:** últimas 40 operações confirmadas no servidor. Inclui páginas verificadas, duração da resposta, tentativas, pausas, retomadas, falhas e conclusão. O resumo mostra as cinco mais recentes.
- **Conexão e configuração:** credenciais fora da tela principal, situação da conexão, callback copiável, OAuth e opção de tokens manuais. Uma migração existente mantém a empresa e a versão fixas.

O status é consultado no **próprio Twenty**, a cada três segundos durante o processamento, a cada segundo enquanto uma ação aguarda confirmação e a cada 15 segundos quando não há processamento ativo. Não há chamadas extras ao RD para atualizar o painel. Consultas de status não se sobrepõem. Em falhas de rede, o painel preserva a última resposta e aumenta o intervalo de tentativas até 20 segundos; comandos de escrita não são repetidos automaticamente. O indicador de atualização torna visível quando os dados podem estar desatualizados.

A atualização começa ao abrir a página, independentemente do status anterior. Pausar ou retomar mantém o acompanhamento até o servidor confirmar a ação; não é necessário recarregar a página. Fechar a página encerra somente as consultas do painel.

## Como interpretar os números

O percentual é de **etapas de leitura concluídas**, não de registros. Cada listagem pode conter um volume muito diferente de dados. O RD não fornece um total global confiável da conta, portanto não há percentual de registros nem previsão artificial de conclusão.

O ritmo exibido é observado na sessão atual do navegador, com até 60 segundos de amostras e ao menos dez segundos de medição ativa. Ele é reiniciado quando os contadores retrocedem ou muda o modo de simulação para importação. O tempo decorrido considera o período desde o início da migração, incluindo pausas, e congela no último checkpoint quando a execução está parada.

Os novos campos de telemetria são opcionais dentro do progresso JSON existente. Checkpoints antigos continuam legíveis. O histórico detalhado começa nos próximos lotes; operações anteriores não são inventadas. Os contadores anteriores são preservados, assim como a ordem dos índices de recursos usada para retomar a execução.

## Ações e proteção dos dados

Abrir, atualizar ou navegar pelo painel **não** inicia nem retoma uma execução. Uma execução pausada permanece pausada. A importação real exige simulação concluída, confirmação de conferência do backup e confirmação no diálogo do Twenty. A API do RD continua restrita a GET para dados, com POST somente no endpoint fixo de tokens OAuth.

A telemetria tem tamanho limitado e não recebe nomes de clientes, URLs, credenciais, conteúdo de registros nem mensagens externas de falha. A fila expõe somente estado e tentativas, sem o texto de erros do provedor.

## Validação

- 268 testes unitários passaram, incluindo controles de execução, polling, recuperação de conexão, confirmação de importação, telemetria limitada, diagnóstico de falhas e preservação dos índices de checkpoint.
- Typecheck e lint sem erros ou avisos.
- O plano de publicação atualizou três entidades e não propôs exclusões de metadados.
- Revisão no navegador em 24/10/2026: abas, busca, filtros, navegação por teclado, configurações protegidas, atualização após recarregar, temas claro/escuro e largura compacta de 820 px sem transbordamento horizontal.
- A atualização em produção preservou a simulação interrompida e seus contadores. Nenhuma importação real foi iniciada durante a revisão.

## Limite atual para bases grandes

A [documentação da API v2](https://developers.rdstation.com/reference/crm-v2-introduction) limita as listagens de empresas, contatos e negociações aos primeiros 10.000 resultados por filtro. O painel reconhece a falha HTTP 400 na página além dessa janela quando o checkpoint já contabiliza 10.000 registros desse recurso, explica o limite e desabilita a retomada da mesma página. Outros erros continuam recebendo a orientação correspondente.

Para ultrapassar essa janela, o importador ainda precisa implementar leituras divididas em filtros menores, com checkpoints e reconciliação próprios. Essa divisão não faz parte desta alteração de interface. O diagnóstico preserva o progresso e não considera a simulação concluída, nem inicia uma nova leitura automaticamente.
