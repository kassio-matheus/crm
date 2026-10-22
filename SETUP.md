# Local setup

Use Node 24 (see `.nvmrc`), Yarn 4, Docker and Twenty >=2.49.0. Keep twenty-sdk, twenty-client-sdk and twenty-ui at the same version.

```sh
yarn install --immutable
open -a Docker
yarn twenty docker:start
yarn twenty remote:add --local
```

Use the bounded sync commands; do not leave `yarn twenty dev` watching partial edits. Before syncing an existing database:

```sh
mkdir -p .twenty/backups
docker exec twenty-app-dev pg_dump -h localhost -U postgres -d default -Fc > .twenty/backups/before-rd-crm.dump
```

On a fresh workspace, `twenty-client-sdk` is a placeholder. Run `yarn setup:workspace`: it syncs only the additive data model from an isolated temporary folder, preserving the live UI, generates the workspace SDK, then immediately applies the complete app. All identifiers stay stable. Both syncs use `--no-delete`. This also works against a configured self-hosted remote; inspect the active remote before running it.

Install the standalone Twenty CLI (`npm install -g twenty`) for the one-time native workspace configuration. After the full app has been applied, run `yarn configure:native-sales`. It sets native sales labels, the six-item sidebar, side-panel opening, stage-based grouping for existing boards and BRL defaults for a PT-BR workspace, without converting existing monetary values. Original settings are saved locally in `.twenty/backups/native-sales/<object-id>/`. Repeating it is idempotent. Use `--locale` to select a different workspace language; other locales preserve existing monetary defaults.

For subsequent edits:

```sh
yarn twenty plan
yarn twenty apply --no-delete
yarn configure:native-sales
```

Open Negociações or Importar do RD Station from the sidebar. Negociações is the native Twenty opportunity screen; the Funil / Filtros action opens the selected pipeline directly as native stage columns and applies transient filters/sorts. Native pipeline views are created during import and prepared on selection for manually created catalogs. Save the actual RD credentials only through the import page. An administrator needs the Applications settings permission to save credentials and operate the import. Model/credit settings for the native AI remain configured in Twenty.

## Isolated integration tests

```sh
yarn twenty docker:start --test
yarn test:unit
yarn typecheck
yarn lint
yarn test
```

The integration suite is restricted to `http://localhost:2021`, uses `~/.twenty/config.test.json`, syncs with deletion inference disabled, and removes only its randomly namespaced fixture records. It never uninstalls the app or touches the development instance on port 2020. Use `TWENTY_API_KEY` if your isolated instance does not use the seeded development key.

During initial validation the Docker image's fresh initialization failed on missing core schema tables. The isolated test container was recovered using a copy of the development database backup; the original development database was not restored or modified. A fresh image bootstrap should therefore be verified for the exact self-hosted release before rollout.

## Railway

Use [docs/RAILWAY.md](docs/RAILWAY.md) and the configuration in `deploy/railway`. This app is installed into a production Twenty server; the local all-in-one development container is not the production image.
