# Campos personalizados e dados da negociação

A importação V2 lê o catálogo `/custom_fields` antes das negociações. Cada entrada de `custom_fields` de uma negociação passa a ter um campo **nativo do Twenty**, com o rótulo do RD, dentro de **Campos personalizados do RD** na página nativa da negociação. Os campos podem ser editados e usados nas visualizações e filtros do Twenty.

| Tipo no RD | Campo no Twenty |
| --- | --- |
| `text`, `hyperlink` | Texto; a URL original é preservada |
| `number` | Número |
| `date` | Data do calendário |
| `option` | Seleção única, com os rótulos das opções do RD |
| `multiple_choice` | Seleção múltipla |
| Tipo desconhecido | JSON, preservando a estrutura disponível |

Quando o catálogo não contém uma chave recebida, o importador infere texto, número, booleano, seleção múltipla de textos ou JSON a partir do valor. A referência técnica usa um nome em inglês e um identificador estável derivado da companhia e do slug, sem depender do nome do cliente ou da execução. As opções usam valores nativos estáveis; seus rótulos continuam iguais aos do RD. Novas opções observadas são acrescentadas sem remover as anteriores.

Valores vazios, zero, `false`, listas e objetos são preservados. Campos de seleção e data vazios ficam nulos no campo nativo; o JSON original retém a representação recebida. Datas impossíveis, números inválidos e colisões com campos existentes interrompem a importação no checkpoint. O sistema não converte nem exclui um campo existente para acomodar uma mudança de tipo.

A criação inclui também ID da negociação, ID da campanha, ID da fonte, data de atualização no RD, valor avulso e valor recorrente em BRL. Status, qualificação, data de criação, valor total, funil, etapa e vínculos já existentes continuam sendo importados. O JSON completo recebido fica em **Dados originais do RD Station**, com a remoção recursiva de credenciais prevista pela política de segurança.

## Repetição e permissões

Uma negociação com o mesmo ID de origem não é recriada. Na repetição, os novos campos de origem e personalizados podem ser preenchidos **somente quando o destino está nulo**. Uma condição na mesma operação do banco protege uma edição manual concorrente. Texto vazio já salvo, zero e outras respostas existentes não são sobrescritos. Isso não implementa uma sincronização recorrente que substitui mudanças feitas no Twenty.

A simulação valida os tipos usando o catálogo da própria execução e não cria campos, visualizações nem registros operacionais. A criação nativa dos personalizados ocorre na importação real da amostra ou da base completa. O administrador precisa de acesso ao modelo de dados; a função da aplicação inclui `DATA_MODEL` para essa criação, além das permissões já usadas pelo importador. O código restringe a descoberta ao objeto de negociações e ao espaço de nomes dos campos importados. Não cria usuários nem altera suas permissões.

Use uma **nova simulação** para carregar o novo plano com o catálogo antes das negociações. Checkpoints antigos mantêm seu plano para evitar reinterpretar os índices já processados. Campos de estrutura são compartilhados pela base e não são excluídos ao remover a amostra. Regras condicionais de obrigatoriedade e exibição do RD permanecem no catálogo de origem; não são convertidas automaticamente em regras de negócio do Twenty.

## Validação

Os testes cobrem texto vazio, zero, números inválidos, datas, opções estáveis e novas opções, seleção múltipla, estruturas desconhecidas, colisões de esquema e proteção de valores manuais. Um teste contra o Twenty isolado em `127.0.0.1:2021` confirmou a criação dos campos nativos, a gravação dos valores e preços, a exposição no formulário e a preservação de edição manual na repetição. Os dados usados nesse teste são fixtures descartáveis, separados da produção.
