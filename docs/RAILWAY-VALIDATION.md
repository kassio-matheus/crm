# Railway deployment validation — 2026-10-23

This record concerns infrastructure packaging and startup. It does not replace the earlier CRM/importer validation in [VALIDATION.md](VALIDATION.md).

## Passed locally

- `yarn install --immutable` completed under Node 24.5.0 / Yarn 4.13.0.
- `yarn typecheck:deployment` passed against the pinned official Railway SDK 3.16.0.
- `yarn test:deployment` passed **17 tests** under Node 24.5.0, covering the complete resource graph, volume persistence/backup declarations, private database services, generated/preserved secrets and shared references, server-only migrations, worker start command, domain port selection, production preflight, bounded dependency retries and unsupported host-patch rejection.
- `yarn lint` passed with zero warnings/errors. `git diff --check` passed.
- Both pinned production Dockerfiles built with BuildKit on the local ARM64 Docker engine: Twenty v2.50.1 with the existing native picker adaptation and the guarded S3 compatibility adaptation; Redis 7.4 with authentication, AOF persistence and `noeviction`.
- `yarn test:deployment:docker` passed using a fresh random `crm-railway-smoke-*` network and two disposable volumes. The worker was started before PostgreSQL/Redis/server. PostgreSQL initialized an empty database; the official Twenty entrypoint ran migrations and cron registration. The server passed `/healthz`; the worker passed dependency/server readiness and started `dist/queue-worker/queue-worker`.
- Redis rejected an unauthenticated PING. A test value persisted through Redis restart, and a disposable SQL table/row persisted through PostgreSQL restart.
- The actual compiled Twenty S3 factory was instantiated inside the image. With `STORAGE_S3_FORCE_PATH_STYLE=false`, it generated a signed virtual-host URL with the bucket in the hostname. Removing that override restored the original path-style default. This was a local signature/configuration test, not a live bucket transfer.
- The Twenty production Dockerfile also built successfully for **linux/amd64**, the Railway target architecture. Both checksum-guarded host adaptations passed on that image. The full local runtime rehearsal used ARM64; cloud runtime acceptance remains pending.
- Smoke-test containers, network, volumes and temporary credential files were removed. Existing local CRM containers/data were not used.

The first two smoke attempts exposed an incompatibility in the test's `docker top` invocation on Docker Desktop: the output must include a PID column. The check was corrected to `pid,args`; the final complete smoke run passed. Worker logs from the earlier run also confirmed actual cron jobs were processed. No production data was involved.

## Cloud checks still required

The pinned Railway CLI 5.71.0 recognizes the local account. No project is linked; `railway config plan` stops with “No linked project found.” No paid services, template draft, public deploy link or production deployment were created.

The following require a selected Railway project and a cloud acceptance run:

1. Apply/reapply the native IaC configuration and verify secret preservation, database volumes, daily/weekly snapshot schedules, bucket provisioning and private DNS.
2. Check the generated HTTPS domain/port, fresh first-admin onboarding, worker jobs and installed CRM extension in that environment.
3. Upload/download an actual attachment through Twenty to the Railway bucket and repeat after a redeploy. Configure and test separate bucket backups.
4. Configure SMTP and confirm invitation/password-reset delivery; configure any AI provider privately.
5. Generate/review a template draft; remove live credentials, retain references and fresh generators, then deploy the template into a separate project. Verify isolated volumes/bucket, distinct secrets and domain before sharing its real button.
6. Test restoration of database, files and encryption keys in a separate environment.

See [RAILWAY.md](RAILWAY.md) for the deployment commands, template registration and production acceptance procedure. A successful local rehearsal is not a claim that the Railway account/environment or template clone has already been validated.
