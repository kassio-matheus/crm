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

On a fresh workspace, `twenty-client-sdk` is a placeholder. Run `yarn setup:workspace`: it syncs the additive data model and temporary page shells from an isolated temporary folder, generates the workspace SDK, then immediately applies the complete app. All identifiers stay stable. Both syncs use `--no-delete`. This also works against a configured self-hosted remote; inspect the active remote before running it.

For subsequent edits:

```sh
yarn twenty plan
yarn twenty apply --no-delete
```

Open Negociações or Importar RD Station from the sidebar. Save the actual RD credentials only through the import page. An administrator needs the Applications settings permission to save credentials and operate the import. Model/credit settings for the native AI remain configured in Twenty.

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
