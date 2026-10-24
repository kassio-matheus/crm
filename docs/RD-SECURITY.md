# RD Station: leitura e conexão OAuth V2

## Política de chamadas externas

A API de dados do RD Station é usada apenas para leitura. Todas as chamadas HTTP diretas do aplicativo passam por `src/rd-client/rd-fetch.ts`; os importadores não escolhem um método de escrita para o RD.

| Caminho | Destino | Método permitido |
| --- | --- | --- |
| Listagens, detalhes e histórico | RD CRM v1/v2 | GET |
| Download de anexos | URL HTTPS temporária em domínio permitido | GET, sem encaminhar credenciais RD |
| Obter/renovar tokens | `https://api.rd.services/oauth2/token` | POST, exclusivamente `authorization_code` ou `refresh_token` |
| Gravar os registros importados | API do próprio Twenty | Mutações internas |
| Enviar anexos copiados | Upload autenticado do Twenty/armazenamento dele | PUT; bloqueado se o destino for um domínio RD |
| Provisionar/operar infraestrutura | Railway, PostgreSQL, Redis, bucket privado | Operações próprias desses serviços; nenhuma API de negócio RD |

A exceção OAuth foi autorizada pelo administrador. O cliente de tokens usa um endereço fixo; não aceita um endpoint fornecido pelo formulário. O transporte bloqueia POST/PUT/PATCH/DELETE/HEAD/OPTIONS nos demais destinos RD, recusa tentativas de sobrescrever métodos por headers/query e desabilita redirecionamentos. GET no RD não aceita body.

O teste `read-only-boundary.spec.ts` percorre os arquivos TypeScript de produção em `src/` e impede chamadas diretas de fetch fora da proteção ou a introdução dos clientes de rede alternativos verificados. Testes adicionais exercitam métodos proibidos, endpoints OAuth parecidos, anexos cujo upload aponta para RD, redirecionamentos e renovação de tokens. A revisão abrangeu também scripts, infraestrutura e workflows: as gravações desses caminhos destinam-se ao Twenty/Railway, não ao RD.

Esta política cobre o código deste aplicativo. Ela não reduz os poderes de um token usado por outros programas ou por administradores fora dele. Não há cadastro de webhook nem criação, atualização ou exclusão de registros no RD neste fluxo.

## Callback e configuração

A URL é derivada da origem pública da instalação, sem gravar o endereço de um workspace no código compartilhado:

```text
https://SEU_DOMINIO/s/rd-station/oauth/callback
```

1. No App Publisher, crie um aplicativo para o produto **RD Station CRM** e cadastre exatamente a URL exibida na página **Importar do RD Station**.
2. No Twenty, informe o identificador estável da empresa, Client ID e Client secret e salve a configuração. O secret é uma variável secreta criptografada do aplicativo.
3. Clique **Gerar autorização** e depois **Autorizar no RD Station**. Confira a conta escolhida antes de consentir no RD.
4. O callback recebe `code` e `state` por GET. Valida o estado gerado por um administrador, prazo de dez minutos, configuração da empresa e uso único. A exclusão atômica do estado impede duas trocas concorrentes do mesmo fluxo.
5. Somente então ocorre POST no endpoint de tokens. O par recebido fica na variável secreta `RD_CREDENTIALS`; o navegador volta a uma URL limpa da página de importação. Os tokens não são retornados na página pública.
6. Conectar não inicia simulação nem importação. Essas ações continuam separadas e exigem autorização administrativa e a confirmação de escopo.

A resposta do callback usa `Cache-Control: no-store` e uma página sem recursos externos, com política de referrer via meta. Os handlers não refletem códigos, estados ou mensagens externas em erros. Sem parâmetros, a URL mostra apenas que o callback está disponível. Estados ausentes, expirados, negados, reutilizados ou de configuração alterada não geram uma troca de tokens.

O RD define prazo curto para o código de autorização e exige troca/renovação via POST. Veja a documentação oficial de [cadastro do aplicativo/callback](https://developers.rdstation.com/reference/crm-v2-authentication-step-1), [autorização](https://developers.rdstation.com/reference/crm-v2-authentication-step-2), [troca do código](https://developers.rdstation.com/reference/crm-v2-authentication-step-3) e [renovação](https://developers.rdstation.com/reference/crm-v2-authentication-step-4).

## Preparação dos dados — 23/10/2026

O administrador autorizou remover apenas a demonstração do Twenty. Após um backup criptografado bem-sucedido, foram identificados pelo nome, autoria SYSTEM/System, ausência de referência RD e IDs conferidos: cinco empresas, cinco contatos e seis negociações. Esses 16 registros foram removidos por soft delete, com `deletedAt` confirmado. Nenhum destroy/purge, SQL de limpeza ou alteração no RD foi executado.

As listas ativas de empresas, contatos, negociações, tarefas e notas ficaram vazias. Workspace, administrador, metadados, permissões e recursos do CRM foram preservados. O inventário e recibo de recuperação ficam localmente em `.twenty/backups/`, fora do Git. Não faça purge da lixeira se precisar recuperar a demonstração.

## Limites de aceitação

Os testes de OAuth usam respostas simuladas, incluindo expiração, replay concorrente, troca de configuração e ausência de exposição dos tokens. O callback e a tela são verificados no servidor publicado sem credenciais RD. A autenticação real com uma conta RD só pode ser validada depois que o administrador cadastrar seu aplicativo e autorizar a conexão. Nenhuma importação foi solicitada durante esta preparação.

## Validação da entrega — 23/10/2026

- Typecheck e lint concluídos sem erros.
- 207 testes unitários passaram em 37 arquivos, com chamadas RD simuladas.
- Plano de publicação: duas funções criadas e duas entidades atualizadas; nenhuma exclusão de metadados. Aplicação em produção concluída com `--no-delete`.
- GET público no callback sem parâmetros: HTTP 200 e `Cache-Control: no-store`. Estado inválido: HTTP 400, sem refletir código/estado na resposta.
- POST no callback público: HTTP 404, pois só há rota GET. Controle de configuração sem autenticação: HTTP 403.
- Status autenticado e navegador confirmaram a URL pública correta, sem credenciais salvas e sem conexão RD iniciada.

Os recibos operacionais ficam em `.twenty/`, ignorado pelo Git. A troca real de tokens e a importação não fazem parte desta validação.

## Correção do callback OAuth — 23/10/2026

O Twenty retorna valores secretos mascarados em `applicationVariables.value`, inclusive para o próprio aplicativo. O callback usa a configuração injetada no servidor e não tenta interpretar esse valor de exibição. Uma chamada interna autenticada consulta somente o SHA-256 da configuração em uma nova execução antes e depois da troca de tokens, para detectar alterações enquanto a execução original mantém seu snapshot. Essa chamada fica no próprio Twenty; não é uma chamada adicional ao RD. O fingerprint exige permissão APPLICATIONS e não retorna credenciais.

Os testes reproduzem metadados mascarados e configuração alterada em uma nova execução, preservando os testes de uso único, expiração e replay concorrente. Os logs do callback contêm somente códigos estáticos permitidos; códigos de autorização, estados, tokens e mensagens externas não entram nesses logs.

A correção passou em typecheck, lint e 56 testes focados em OAuth/segurança HTTP. A sincronização em produção atualizou duas funções, sem exclusões. Após o administrador concluir pessoalmente o consentimento no RD, o callback retornou à página limpa do CRM e a tela confirmou “RD Station conectado”. A troca real de código por tokens foi validada com a configuração já salva. Nenhuma simulação ou importação foi iniciada; consultas de negócio e renovação real de tokens não foram exercitadas nessa verificação.

## Paginação V2 — 23/10/2026

Uma resposta real de organizações devolveu a próxima página sob `https://api.rd.services/api/v2/organizations`, enquanto a base documentada é `https://api.rd.services/crm/v2/`. Esse checkpoint era bloqueado antes da requisição seguinte. O cliente agora normaliza apenas o prefixo V2 nesse domínio HTTPS exato e exige que o caminho continue sendo o mesmo recurso originalmente solicitado. Host alternativo, HTTP, porta alternativa, usuário/senha na URL, fragmento e troca de recurso continuam bloqueados. A URL é validada também antes de salvar o próximo checkpoint; parâmetros são preservados e canonizados para detectar cursores repetidos.

A correção passou em typecheck, lint e 71 testes focados no cliente RD, política de transporte, paginação e worker. A retomada mantém a simulação (`dryRun`) e seus contadores, sem iniciar uma importação real.

Em produção, a sincronização atualizou apenas o worker, com zero exclusões. A simulação foi retomada do checkpoint existente e avançou da página 2 para a 13 de organizações: 364 registros verificados, 22 requisições, `dryRun: true`, `created: 0`, sem erro nesse ponto. A simulação continuava em andamento; esse resultado confirma a recuperação da paginação, não a conclusão da validação de toda a conta.
