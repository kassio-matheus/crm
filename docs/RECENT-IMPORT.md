# Teste recente e importação completa

## Fluxo da página

1. **Simular dados recentes:** lê até 25 negociações em ordem de criação decrescente, usando uma data de corte fixa. Busca por ID as empresas e o contato principal necessários, mesmo quando são antigos. Verifica os valores projetados e conflitos de e-mail sem criar dados operacionais.
2. **Criar amostra no Twenty:** cria exatamente os IDs de negociação verificados, seus vínculos, funis e etapas. Inclui uma amostra de até cinco tarefas por negociação. Isso não representa validação de toda a base, de todos os anexos ou do histórico antigo.
3. **Excluir dados da amostra:** opcionalmente envia à lixeira apenas os registros operacionais novos identificados pelo teste. O histórico técnico, snapshots e comprovantes são mantidos para auditoria e recuperação. Não há destroy/purge. Registros anteriores não são associados à amostra por nome ou semelhança.
4. **Importar tudo de vez:** ação separada, com conferência do backup e confirmação no diálogo do Twenty. Percorre todos os recursos acessíveis pela API, priorizando as negociações recentes e buscando suas referências conforme necessário. A amostra é incorporada sem duplicações; se tiver sido enviada à lixeira pelo botão, seus registros são restaurados antes da leitura completa. A exclusão de teste fica desativada depois dessa promoção.

## Além de 10.000 registros

A [API v2 limita as listagens de empresas, contatos e negociações a 10.000 resultados por filtro](https://developers.rdstation.com/reference/crm-v2-introduction). O importador usa os filtros documentados de `created_at` e ordenação decrescente. Ao concluir a página 399 de 25 registros, se houver continuação, guarda a menor data dessa página como novo limite superior inclusivo e recomeça na página 1. A sobreposição retém todos os registros empatados na data de fronteira; os IDs determinísticos e comprovantes impedem outra criação.

Não usa um limite global de registros no modo completo. O limite de 25 negociações pertence somente à amostra. Catálogos necessários são lidos primeiro, as negociações vêm antes da varredura das empresas e contatos sem vínculo já buscado, e os detalhes completos são percorridos na etapa própria. As demais entidades usam as ordenações disponíveis em sua API, como atualização decrescente para tarefas.

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
- Novos fluxos exigem API v2. Checkpoints legados continuam legíveis e retomáveis nas condições anteriores.
- A função de fundo aceita até 900 segundos para uma página com referências; pausa e recuperação continuam nos limites de checkpoint. Fechar o navegador não para a fila.

## Validação

Os testes cobrem os filtros decrescentes e sua preservação nos cursores, mais de 10.000 registros sintéticos com empates, datas inválidas, timestamps densos, referências por ID, amostra congelada, retomada parcial, propriedade persistida antes da criação, exclusão bloqueada por vínculos externos, soft delete/restauração e promoção da amostra para o fluxo completo. Os testes contra banco usam somente localhost:2021 e fixtures isoladas, sem chamadas reais ao RD.
