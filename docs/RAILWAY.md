# Twenty Sales CRM no Railway

A infraestrutura inteira está em [`.railway/railway.ts`](../.railway/railway.ts), usando o SDK oficial `railway/iac`. O Railway cria os serviços, volumes, bucket e referências de credenciais no mesmo projeto. O script de implantação completa o domínio HTTPS e aguarda a saúde do servidor. Não é necessário criar banco ou Redis manualmente.

Este repositório contém uma extensão do Twenty e uma imagem do servidor oficial com adaptações pontuais. A infraestrutura sobe o Twenty; a extensão de CRM é instalada depois da criação do primeiro administrador/workspace. Credenciais do RD Station, SMTP e IA são informadas pelo administrador, nunca embutidas na imagem.

## Recursos provisionados

| Recurso         | Configuração                                                                    | Persistência / acesso                                                                     |
| --------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `Twenty`        | Twenty v2.50.1, imagem oficial fixada por digest, adaptações nativas existentes | Único serviço com domínio público HTTPS, porta 3000, `/healthz`                           |
| `Twenty Worker` | Mesmo código e imagem base, `yarn worker:prod`                                  | Rede privada; aguarda PostgreSQL, Redis e migrações do servidor                           |
| `Postgres`      | PostgreSQL 16 Alpine, imagem fixada por digest                                  | Volume inicial de 4 GiB; rede privada, senha gerada; cópia lógica diária criptografada    |
| `Redis`         | Redis 7.4 Alpine, imagem fixada por digest                                      | Volume inicial de 1 GiB; autenticação, AOF `everysec`, `noeviction`; persistência da fila |
| `Storage`       | Bucket S3 privado nativo do Railway, região `iad`                               | Anexos compartilhados entre servidor e worker; credenciais por referência                 |

Os volumes iniciais somam 5 GiB (4 GiB PostgreSQL e 1 GiB Redis), dentro da capacidade do Hobby, sem upgrade automático. O limite financeiro do Railway é do workspace inteiro; não o altere para um projeto isolado sem avaliar os outros serviços.

Os serviços executam uma réplica na região `us-east4-eqdc4a`. Ajuste região, volumes e recursos no arquivo antes do primeiro deploy. O bucket tem região independente e imutável após sua criação. O endpoint S3 usa HTTPS autenticado; não é um volume local nem uma conexão pela rede privada dos contêineres. Os volumes não fornecem alta disponibilidade. O PostgreSQL e o Redis são contêineres sob sua responsabilidade operacional.

O serviço `Database Backup` executa diariamente às 06:00 UTC (03:00 em Maceió), gera um `pg_dump` consistente e compactado, criptografa com AES-256-GCM e verifica o tamanho do objeto enviado ao bucket privado. Ele termina após cada execução. Snapshots nativos de volume exigem Pro e não são provisionados no Hobby.

## Primeira implantação da infraestrutura

Requisitos: conta Railway com capacidade de cobrança para os recursos, GitHub conectado ao Railway com acesso ao repositório, Node 24 e Yarn 4. **Publique os arquivos desta alteração na branch `main` antes de provisionar**, pois o Railway constrói a partir do GitHub. Se usar fork/branch diferente, altere `repository` e as origens em `.railway/railway.ts` antes do plano.

```sh
yarn install --immutable
yarn railway login
yarn railway init --name twenty-sales-crm
yarn railway:plan
yarn railway:deploy
```

`init` cria e vincula um projeto novo; use um projeto dedicado vazio. `railway:plan` consulta o Railway e mostra mudanças sem aplicar. `railway:deploy` usa a confirmação nativa do Railway, aplica todos os recursos, gera o domínio público de `Twenty` na porta 3000 e inicia os deploys finais de servidor e worker. Ele aguarda até 30 minutos pelo `/healthz`, incluindo tempo de build. A primeira tentativa automática de boot pode falhar enquanto o domínio ainda não existe; o script resolve o domínio e reimplanta os processos com `SERVER_URL` válido. O worker aguarda a saúde do servidor antes de iniciar o consumidor de filas.

O ambiente padrão é `production`; `CRM_RAILWAY_ENVIRONMENT` seleciona outro por nome/ID. Para construir uma branch de manutenção publicada no GitHub, use `CRM_RAILWAY_BRANCH`; o padrão é `main`. `TRUST_PROXY=1` reconhece o HTTPS terminado na borda Railway; não exponha diretamente o contêiner fora dessa arquitetura. Depois de alterar o domínio, reimplante servidor e worker para atualizar os endereços usados por uploads e login.

O script não aceita flags para ignorar confirmação e não autoriza exclusões destrutivas automaticamente. Se houver falha, os recursos são preservados; corrija o motivo nos logs e execute novamente. Leia o projeto/ambiente exibido pelo plano antes de confirmar. Não use este arquivo completo sobre um projeto com recursos de outros sistemas.

Antes do IaC, o script gera cinco segredos independentes de 256 bits com `node:crypto` e os salva como variáveis compartilhadas privadas do projeto: PostgreSQL, Redis, `ENCRYPTION_KEY`, `APP_SECRET` e `BACKUP_ENCRYPTION_KEY`. O IaC referencia esses valores. Reexecutar preserva segredos e rejeita valores inválidos em vez de substituí-los automaticamente. O inicializador preserva SMTP e IA configurados. Expressões `secret(...)` são geradores de templates, não uma API de geração do IaC; nunca use o texto da expressão como senha. O worker usa referências do servidor para compartilhar configuração. Não copie as chaves para arquivos versionados e **nunca regenere `ENCRYPTION_KEY` sobre um banco existente**. Exporte as chaves para um cofre privado para recuperação de desastre.

Se preferir domínio próprio, configure-o no serviço `Twenty`, substitua `SERVER_URL` em `.railway/railway.ts` pela origem HTTPS final e reimplante servidor e worker. `RAILWAY_PUBLIC_DOMAIN` continua apontando ao domínio gerado do Railway; adicionar um domínio próprio sozinho não muda essa variável.

## Transformar em deploy por um clique

Depois de subir e validar uma instalação de referência, execute:

```sh
yarn railway:template
```

O comando oficial `railway templates create --json` gera um **rascunho não publicado** a partir do projeto vinculado e informa o identificador/editor do template. No editor do Railway:

1. Confirme os cinco serviços, os dois volumes e o bucket `Storage`, com suas referências. Confira o cron do backup e os caminhos de Dockerfile de `Twenty`, `Twenty Worker` e `Redis`. Se o editor não transportar algum recurso/configuração, corrija o rascunho antes de compartilhá-lo.
2. Habilite um domínio HTTP com porta 3000 somente para `Twenty`. Banco, Redis e worker permanecem sem domínio público e sem TCP Proxy.
3. Substitua qualquer segredo copiado da instalação de referência por gerador de template: `${{secret(64, "0123456789abcdef")}}` para `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `ENCRYPTION_KEY`, `APP_SECRET` e `BACKUP_ENCRYPTION_KEY`, cada um em seu serviço de origem. Preserve referências no worker. Cada instalação deve receber chaves novas e independentes.
4. O bucket precisa ser criado para cada instalação; use suas referências `BUCKET`, `REGION`, `ENDPOINT`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`. Não publique credenciais de um bucket já existente.
5. Remova SMTP, IA, tokens do RD, IDs de clientes e qualquer valor privado da instalação de referência. O template provisiona volumes vazios; dados do CRM não devem fazer parte de uma imagem.
6. Finalize o template e faça um deploy de aceitação em um projeto separado. Só compartilhe o botão depois de conferir domínio, conexões, chaves distintas, backups e anexos nessa nova instalação.

O link/botão real é emitido pelo Railway após o registro; não basta adicionar um arquivo `railway.json` ou um link arbitrário ao GitHub. Use o código real retornado pela plataforma no formato do botão documentado pelo Railway. Publicação no marketplace é opcional e separada da geração do rascunho.

**Estado:** a instalação de referência foi provisionada no Railway em 23/10/2026. O template reutilizável ainda precisa de registro, revisão de segredos e teste de clone antes de divulgar um botão. Veja `RAILWAY-VALIDATION.md`.

## Preparar o CRM depois do primeiro boot

Abra a URL informada pelo script, crie o primeiro administrador e workspace no fluxo nativo do Twenty. No computador de manutenção, com o CLI oficial `twenty@2.49.0` autenticado no workspace:

```sh
npm install --global twenty@2.49.0
twenty auth login --url https://crm.seu-dominio.com --name production
twenty remote use production
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

O bootstrap é aditivo e gera o SDK antes do build completo. A instalação configura funis/etapas, filtros, ações diretas, menu com seis itens e abertura lateral nativa. O padrão PT-BR usa BRL para novos valores; valores existentes não são convertidos. Não execute testes de integração contra produção e não use `twenty docker:start` para hospedar o servidor publicado. Atualizações do aplicativo publicadas/instaladas exigem aumento de versão.

O workflow manual `.github/workflows/cd.yml` instala a extensão usando o environment protegido `production` e os valores `TWENTY_DEPLOY_URL` e `TWENTY_DEPLOY_API_KEY`. Ele complementa a infraestrutura; não a provisiona. Proteja esse environment com revisores e use uma chave restrita ao workspace pretendido.

### E-mail, IA e funções

A infraestrutura inicia com `EMAIL_DRIVER=LOGGER`: os e-mails são registrados, não entregues. Configure um provedor SMTP em **Twenty → Variables** no Railway antes de liberar convites e recuperação de senha:

- `EMAIL_DRIVER=SMTP`, `EMAIL_FROM_ADDRESS` e `EMAIL_FROM_NAME`;
- `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASSWORD`;
- mantenha `EMAIL_SMTP_NO_TLS=false` e valide a entrega real.

Essas variáveis e `AI_PROVIDERS` estão declaradas com preservação dos valores existentes. Configure IA privadamente conforme o formato suportado pelo Twenty. O worker referencia os mesmos valores; reimplante os dois após alterações. Para novos parâmetros não declarados, adicione-os ao IaC, usando referências ou `preserve()` para segredos já cadastrados; o plano completo pode propor remover variáveis que não conhece. Revise o plano e nunca versione valores privados.

O perfil incluído usa `LOGIC_FUNCTION_TYPE=LOCAL` e `TRUSTED_LOCAL_FUNCTIONS=true` para executar o importador inteiramente no Railway, sem AWS. Destina-se a uma única empresa onde apenas administradores de confiança instalam aplicativos/código revisado: o driver LOCAL não fornece sandbox isolada. O interpretador de código permanece desabilitado. Se for necessário isolamento para autores de código não confiáveis, configure o driver `LAMBDA`, seus recursos e permissões AWS antes de habilitar esse público; essa alternativa não é provisionada por este template.

### Arquivos

A imagem adapta exclusivamente a opção S3 `forcePathStyle`, que era fixa em `true` no Twenty v2.50.1. `STORAGE_S3_FORCE_PATH_STYLE=false` permite os novos buckets Railway com URLs virtuais por host. O build confere o hash exato do arquivo original e recusa versões desconhecidas. O seletor nativo de funis mantém a [adaptação já existente](../deploy/native-ui/README.md).

O bucket permanece privado. `STORAGE_S3_PRESIGNED_URL_ENABLED=false` mantém os arquivos passando pela API autenticada do Twenty; esse perfil dispensa acesso direto do navegador ao bucket. Se habilitar URLs pré-assinadas no futuro, revise CORS e teste upload/download com a origem HTTPS final.

## Testes e limites da validação

Veja o [registro da validação local de 23/10/2026](RAILWAY-VALIDATION.md), com resultados e verificações em nuvem ainda pendentes.

```sh
yarn typecheck:deployment
yarn test:deployment
yarn test:deployment:docker
```

A última verificação requer Docker/BuildKit e cria uma rede, contêineres e volumes com prefixo aleatório `crm-railway-smoke-*`. Constrói as imagens de produção, inicia o worker antes dos dados, executa migrações em banco vazio, verifica `/healthz`, início do worker, autenticação Redis e persistência PostgreSQL/Redis após reiniciar. No final remove somente seus próprios recursos. Não acessa os dados do Twenty local em `localhost:2020`.

O ensaio local usa um endpoint S3 fictício e não valida transferências no bucket nativo, roteamento Railway, SMTP, registro/clone de template ou restauração de backup em nuvem. O workflow `railway-infrastructure.yml` faz validação estática em pull requests; o ensaio Docker é executado quando iniciado manualmente. Esses limites devem ser concluídos no ambiente de aceitação antes de liberar o cliente.

No Railway, valide: login, `/healthz`, logs e execução real de uma função pelo worker; selecionar dois funis incluindo etapas vazias; negociação sintética com Pausar/Retomar/Perda/Venda; upload e download de um anexo e persistência após novo deploy; simulação do importador; entrega SMTP; restauração em ambiente separado. Verifique que PostgreSQL/Redis/worker não têm exposição pública, que os backups foram efetivamente agendados e que as chaves de um clone diferem da instalação de referência.

## Backups, atualizações e instalações existentes

O serviço agendado cria backup lógico consistente do PostgreSQL no bucket privado com chave independente. Não apaga cópias automaticamente. Defina retenção, acompanhe falhas e mantenha uma segunda cópia fora do projeto Railway. Snapshots nativos de volumes exigem Pro; o deploy Hobby não faz upgrade e não inclui esses snapshots. Redis mantém AOF, mas não tem cópia externa neste perfil. AOF `everysec` permite perder aproximadamente um segundo de gravações Redis em falha abrupta; o importador também usa checkpoints no PostgreSQL.

O conteúdo dos anexos **não está incluído no dump PostgreSQL**. Preserve-o separadamente junto com `ENCRYPTION_KEY`, eventual `FALLBACK_ENCRYPTION_KEY`, `APP_SECRET`, configuração e versão da extensão. O template não cria uma política de backup externo do bucket. Defina-a antes da entrada em produção; um dump SQL sozinho não recupera anexos.

Antes de atualizar: pause importações, obtenha backups, teste em staging, revise o plano e publique servidor/worker com o mesmo commit. As imagens base estão fixadas por digest; uma atualização de Twenty exige revisar as duas adaptações e repetir o ensaio. Um rollback de imagem não reverte migrações de banco. Não use uninstall para rollback da extensão.

Instalações Railway antigas que usam `railway.server.json`/`railway.worker.json` precisam de migração explícita: faça backup e use `railway config migrate` conforme a documentação antes de adotar o IaC. Esses arquivos de configuração por serviço foram substituídos neste repositório pela declaração única. Não execute `init`/o template para substituir uma instalação com dados e não troque seus volumes ou chaves sem procedimento de migração revisado.

### Recuperar uma cópia do banco

Baixe um arquivo `maintenance/postgres/*.dump.enc` do bucket como administrador. Obtenha `CRM_BACKUP_ENCRYPTION_KEY` do cofre e disponibilize como `BACKUP_ENCRYPTION_KEY` no ambiente local, sem gravar no histórico de comandos. Execute:

```sh
node deploy/railway/backup/decrypt.mjs downloaded.dump.enc restored.dump
pg_restore --list restored.dump
# PostgreSQL isolado e vazio, com credenciais via PG*:
pg_restore --exit-on-error --no-owner --no-acl --dbname twenty restored.dump
```

O decrypt recusa sobrescrita e valida a autenticação criptográfica. Preserve também as chaves do Twenty e os arquivos S3. Teste a recuperação fora de produção antes de substituir uma instalação existente.

## Referências oficiais consultadas

- [Railway Infrastructure as Code](https://docs.railway.com/infrastructure-as-code) e [referência do SDK](https://docs.railway.com/infrastructure-as-code/reference).
- [CLI config: plan/apply/migrate](https://docs.railway.com/cli/config).
- [Conversão de Docker Compose](https://docs.railway.com/guides/docker-compose): serviços separados e ausência de `depends_on`.
- [Criar templates e gerar segredos](https://docs.railway.com/templates/create), [CLI templates](https://docs.railway.com/cli/templates) e [publicar/compartilhar](https://docs.railway.com/templates/publish-and-share).
- [Buckets S3](https://docs.railway.com/storage-buckets), [upload/serving](https://docs.railway.com/storage-buckets/uploading-serving) e [backups de volumes](https://docs.railway.com/volumes/backups).
- [Composição oficial do Twenty v2.50.1](https://github.com/twentyhq/twenty/blob/twenty/v2.50.1/packages/twenty-docker/docker-compose.yml) e [configuração self-hosted](https://docs.twenty.com/developers/self-host/capabilities/setup).
