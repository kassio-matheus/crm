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

## Cloud acceptance in progress — 2026-10-23

- A dedicated Railway production environment was provisioned with Twenty, worker, PostgreSQL 16, Redis 7.4, private native S3 storage and two persistent volumes totaling 5 GiB. The existing Hobby plan and workspace spending cap were preserved.
- The first administrator completed native onboarding and created the workspace. HTTPS login and `/healthz` passed at the final domain.
- A production preflight check rejected invalid secrets before startup. The native IaC `generator` property had been interpreted as a literal expression. Provisioning now generates five independent 256-bit secrets with Node crypto, saves shared variables through secret-safe stdin, and references them from IaC. Existing values are preserved and malformed values fail closed. PostgreSQL authentication was repaired before CRM data initialization; the temporary repair start command was removed.
- `TRUST_PROXY=1` corrects OAuth discovery behind Railway's HTTPS edge. After a domain rename, server/worker must be redeployed: a live upload test exposed stale links to the previous domain. After redeployment the upload target used the final origin and an authenticated upload returned HTTP 204 through Twenty to the private bucket.
- Native volume backup scheduling was rejected by Railway because it requires Pro. No Pro upgrade or native snapshot schedule was enabled. An encrypted daily logical PostgreSQL backup service is included instead; first cloud run and restore acceptance are recorded below when completed.
- Current deployment validation passes 23 targeted tests, including cryptographic round-trip/tamper rejection and daily cron configuration. Deployment typecheck and lint pass. The backup Dockerfile builds from the pinned official image; it uses a PostgreSQL 16 client matching the server and the image's AWS SDK.

Still required before describing the deployment as fully accepted: install/configure the CRM extension; verify native funnel columns, actions, menu and import page; run/decrypt/restore a real backup in isolation; verify attachment download; configure and test SMTP and any AI provider. External backup of bucket attachments, a reusable template draft/clone and disaster recovery across a lost Railway project are separate pending work. No integration suite is run against production.

See [RAILWAY.md](RAILWAY.md) for operations and recovery instructions.

## Final workspace checks

- Additive sync created 392 metadata entities with zero changes/deletions to existing metadata in the initial plan. The registered 0.1.0 tarball installer failed its pending MIME constraint; the active extension was installed with bounded `apply --no-delete`. No database constraints were dropped. The maintenance workflow now uses the validated additive path.
- Production generated SDK typecheck passed. All 152 unit tests passed. The six requested workspace sidebar labels and BRL defaults for opportunity amount/company annual revenue were verified through metadata. Existing monetary values were preserved.
- The native RD import page rendered in Chrome with empty credential inputs. `health-check` returned OK and `rd-import` with action `status` returned SUCCESS/null. No simulation, import start, credential save or RD API call was made.
- The daily backup job completed a real cloud run in two seconds and reported BACKUP_OK for an encrypted 1,356,942-byte object. A PostgreSQL 16 client is now used to ensure restoration compatibility with the database version.
- Email and AI setup were explicitly deferred. The user requested only the completed structure, with no import now. Live RD data migration and SMTP delivery are therefore not part of acceptance for this run.
- Current production sources use the maintenance branch `codex/railway-production`. Merge its pull request before switching sources back to `main`. Preserve all shared encryption keys.
