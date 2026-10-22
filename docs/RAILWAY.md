# Produção no Railway

## O que está preparado

Este repositório é um aplicativo do Twenty, não um servidor web independente. Não use `yarn start`, `twenty docker:start` ou a imagem `twenty-app-dev` em produção. O aplicativo é instalado no Twenty depois que a infraestrutura estiver disponível.

A pasta `deploy/railway` contém a imagem oficial de produção **Twenty v2.50.1**, fixada por digest, configurações separadas de servidor e worker, exemplo de variáveis e uma verificação de configuração antes da inicialização. A versão do SDK do aplicativo permanece 2.49.0. Esta combinação foi validada localmente; não publique uma imagem `latest` sem testar a atualização.

A imagem foi construída localmente e a verificação de configuração foi testada. Ainda são necessários a conta Railway, domínio, serviços de dados, armazenamento, segredos e a validação no ambiente real. Nenhuma infraestrutura paga foi criada e nenhum deploy de produção foi executado.

## 1. Criar a infraestrutura

No mesmo projeto e ambiente Railway, crie:

| Serviço | Origem/configuração | Persistência e acesso |
| --- | --- | --- |
| `Postgres` | PostgreSQL 16, conforme a composição oficial do Twenty | Volume persistente, backups programados, conexão pela rede privada |
| `Redis` | Redis, com `--maxmemory-policy noeviction` | Volume e persistência AOF (`--appendonly yes`); sem domínio público |
| `Storage` | Bucket privado S3 compatível do Railway | Arquivos compartilhados pelo servidor e worker |
| `Twenty` | Este GitHub repo, branch de release revisada | Configuração `/deploy/railway/railway.server.json` |
| `Twenty Worker` | O mesmo repo e commit do servidor | Configuração `/deploy/railway/railway.worker.json`; sem domínio público |

Nos dois serviços do repo, deixe **Root Directory** na raiz e selecione o caminho de configuração correspondente em Settings → Config as Code. O Dockerfile já referencia a imagem oficial; ele não compila o monorepo do Twenty. Gere um domínio HTTPS apenas para `Twenty`, com porta alvo **3000**. O servidor usa `/healthz` para liberar o deploy; o worker usa `/app/railway-entrypoint.sh yarn worker:prod` (preservando a checagem mesmo com o override de start do Railway) e sua fila deve ser acompanhada pelos logs.

Ative primeiro banco e Redis; suba o servidor e aguarde `/healthz` responder, depois inicie o worker. Use uma réplica de cada processo inicialmente; as migrações e o registro de cron ficam apenas no servidor. Dimensione memória por métricas e valide uma importação representativa antes da abertura ao cliente.

A separação entre serviços, volumes e rede segue o [guia do Railway](https://docs.railway.com/guides/docker-compose) e a [composição oficial da versão v2.50.1](https://github.com/twentyhq/twenty/blob/twenty/v2.50.1/packages/twenty-docker/docker-compose.yml).

## 2. Variáveis e arquivos

Use `deploy/railway/variables.example` como roteiro no editor de variáveis. Os nomes dos serviços precisam coincidir com as referências `${{...}}`. Confira os nomes reais das variáveis disponibilizadas pelo bucket; adapte as referências se a interface usar outros nomes.

- `PG_DATABASE_URL` e `REDIS_URL`: URLs privadas dos respectivos serviços. Não copie credenciais para o Git.
- `SERVER_URL`: origem HTTPS final do CRM, sem caminhos. Ao usar domínio próprio, atualize servidor e worker.
- `NODE_PORT=3000` e `PORT=3000`: devem coincidir com a porta alvo do domínio.
- Gere **dois** segredos independentes com `openssl rand -base64 32`: `ENCRYPTION_KEY` e `APP_SECRET`. Guarde-os em um cofre. Eles precisam ser idênticos entre servidor e worker e sobreviver às atualizações. Em uma migração de instalação existente, preserve as chaves anteriores; não gere chaves novas sobre um banco com segredos criptografados.
- `STORAGE_TYPE=s3`: configure os valores `STORAGE_S3_*` do exemplo. Server e worker devem apontar para o mesmo bucket e usar os mesmos valores. Não use o sistema de arquivos temporário de um serviço Railway para anexos.
- Mantenha `NODE_ENV=production`, `SIGN_IN_PREFILLED=false`, `IS_MULTIWORKSPACE_ENABLED=false`, `CODE_INTERPRETER_TYPE=DISABLED` e `IS_CONFIG_VARIABLES_IN_DB_ENABLED=false`. Este último torna as variáveis do Railway a configuração efetiva; integrações e SMTP também são configurados por variáveis nesse perfil.
- No worker, use referências `${{Twenty.NOME_DA_VARIAVEL}}` para os valores compartilhados. Sobrescreva somente `DISABLE_DB_MIGRATIONS=true` e `DISABLE_CRON_JOBS_REGISTRATION=true`; no servidor, ambos são `false`.

No bucket, permita CORS somente para a origem HTTPS do CRM, com GET/PUT/HEAD e os cabeçalhos necessários ao upload. O bucket permanece privado. Valide upload, download e um anexo importado após reiniciar ambos os processos. Configure SMTP para convites e recuperação de senha antes de cadastrar a equipe. Os detalhes de chaves, S3 e funções estão na [documentação oficial do Twenty](https://docs.twenty.com/developers/self-host/capabilities/setup).

## 3. Habilitar as funções do aplicativo

O importador, a preparação dos quadros e as atualizações automáticas dependem de funções de lógica. Elas vêm desabilitadas por padrão em produção.

O exemplo adota `LOGIC_FUNCTION_TYPE=LAMBDA`, com isolamento. Configure região, papel IAM de execução, credenciais do controlador Lambda e bucket privado AWS para camadas de dependências. O papel precisa poder executar a função, e as credenciais do controlador precisam das operações de provisionamento Lambda, publicação de camadas, passagem desse papel e acesso ao bucket de camadas, limitados aos recursos dedicados ao Twenty. Siga a configuração oficial do driver; valide o provisionamento e a execução de uma função instalada antes da importação. O bucket AWS de camadas é diferente do bucket de arquivos do CRM.

Para uma instalação de uma única empresa, onde **somente administradores de confiança publicam código revisado**, é possível executar tudo no Railway com `LOGIC_FUNCTION_TYPE=LOCAL` e `TRUSTED_LOCAL_FUNCTIONS=true`. Nesse perfil, remova as variáveis `LOGIC_FUNCTION_LAMBDA_*`. O driver LOCAL executa código no mesmo ambiente dos serviços e não fornece isolamento de sandbox. Não conceda publicação de aplicativos ou edição de funções a pessoas sem essa confiança. A checagem exige essa escolha explícita; não ativa o driver LOCAL automaticamente.

O perfil Lambda requer serviços AWS e ainda não foi executado com as credenciais de produção. O perfil LOCAL e as funções deste aplicativo foram exercitados na instância local isolada. A publicação só deve ser liberada depois do teste do perfil escolhido no Railway.

## 4. Instalar o aplicativo e configurar o workspace

Crie o administrador no Twenty publicado. No computador de manutenção, use Node 24.5+ da linha 24, Yarn 4 e o CLI oficial `twenty@2.49.0`. Instale as dependências com `yarn install --immutable`. Cadastre e selecione explicitamente o remote de produção; autentique pelo CLI e não envie chaves em mensagens.

```bash
npm install --global twenty@2.49.0
yarn twenty remote:add --url https://crm.seu-dominio.com --as production
yarn twenty remote:use production
yarn setup:workspace --model-only
yarn typecheck
yarn lint
yarn test:unit
yarn test:deployment
yarn twenty dev:build
yarn twenty app:publish --private --remote production
yarn twenty app:install --remote production
TWENTY_REMOTE=production yarn configure:native-sales --locale pt-BR
```

O bootstrap aplica o modelo de forma aditiva e gera o cliente tipado antes do build completo. Em atualizações, aumente a versão do aplicativo antes de publicar. Faça backup antes de alterar a instalação. Não execute a suíte de integração em produção: ela é restrita a `localhost:2021`.

A configuração final ajusta metadados nativos: menu de trabalho com seis itens, abertura lateral, resumo da negociação, agrupamento de quadros por etapa e BRL como moeda padrão dos campos monetários do workspace PT-BR. Ela **não converte valores existentes**. O Twenty não oferece, via esta extensão, um padrão de moeda diferente por usuário no mesmo workspace: em uma equipe multilíngue, o padrão BRL continua sendo do workspace; valores em outras moedas mantêm sua moeda. Para outro idioma, use `--locale` correspondente para preservar os padrões monetários existentes.

Negociações sem etapa ficam acessíveis na Lista e só aparecem como cards depois que uma etapa for atribuída.

As configurações anteriores ficam em `.twenty/backups/native-sales/<object-id>/`. O script remove atalhos excedentes, preservando seus objetos, registros, páginas e visualizações. Favoritos pessoais e os controles do sistema do Twenty continuam disponíveis. Configuração de funis e etapas fica no painel **Funil / Filtros**.

## 5. Publicação pelo GitHub

O workflow `cd.yml` é manual e usa o environment protegido `production`. Cadastre nele a variável `TWENTY_DEPLOY_URL`, o secret `TWENTY_DEPLOY_API_KEY` e revisores obrigatórios. A chave precisa administrar aplicativos, visualizações e os ajustes de metadados realizados na configuração. Limite seu acesso ao workspace pretendido.

O workflow faz bootstrap aditivo, gera o SDK, verifica o aplicativo, publica privadamente, instala e aplica os padrões PT-BR. Ele não cria os serviços Railway e não roda testes destrutivos de integração contra produção. Configure a branch usada pelo servidor e worker para que ambos recebam o mesmo commit revisado.

## 6. Validação antes de liberar o cliente

1. Confirmar `/healthz`, login, recuperação de senha e convites por SMTP.
2. Selecionar dois funis distintos e verificar que cada quadro exibe somente suas etapas, incluindo as vazias; arrastar uma negociação sintética entre etapas e conferir o funil.
3. Na negociação sintética, usar Pausar → Retomar → Marcar perda → Marcar venda. Conferir que etapa, responsável, valor e histórico importado permanecem corretos.
4. Criar um valor novo e conferir BRL; conferir que registros antigos em USD continuam em USD.
5. Criar uma tarefa vinculada e confirmar a atualização automática da próxima atividade após concluir a tarefa. Reiniciar o worker e verificar recuperação da fila.
6. Validar upload/download e persistência dos anexos após novo deploy.
7. Na página Importar do RD Station, salvar credenciais, simular e revisar o relatório antes de iniciar. Verificar limite de requisições, pausa/retomada e repetição sem duplicatas com um conjunto representativo.
8. Restaurar um backup em ambiente separado e validar login, registros, anexos e descriptografia de credenciais. Remover apenas os registros sintéticos de validação.

## Backups, atualizações e recuperação

Programe backups do volume PostgreSQL no Railway e uma cópia externa criptografada. Defina retenção conforme o negócio e teste a restauração. Preserve separadamente o bucket de arquivos, `ENCRYPTION_KEY`, eventual `FALLBACK_ENCRYPTION_KEY`, `APP_SECRET`, configuração de infraestrutura e o commit/versão do aplicativo. Um backup SQL não contém os arquivos do bucket. A política do serviço está no [guia de backups do Railway](https://docs.railway.com/volumes/backups).

Antes de atualizar, pause a importação, obtenha backup consistente, teste a nova versão em staging, publique servidor e worker com a mesma imagem e execute a validação acima. Um rollback de container não desfaz migrações do banco. Quando houver mudança de esquema incompatível, restaure banco, arquivos e chaves correspondentes em um ambiente isolado e valide antes de trocar o tráfego. Não restaure o dump de desenvolvimento sobre produção nem leve os dados de demonstração Apple para o cliente.
