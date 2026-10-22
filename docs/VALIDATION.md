# Validation record — 2026-10-22

The sales screen uses Twenty's native kanban, table, record side panel, fields, relation cards and activity tabs. Pipeline selection opens a native saved view whose columns are the selected pipeline's ordered stage records. Status remains independent of stage. The encrypted, resumable RD importer is preserved.

## Automated checks

- **141 unit tests passed** across 25 files under Node **24.5.0**. Coverage includes RD pagination/rate limiting and recovery, credentials, source preservation, native URL filters, catalog pagination, pipeline view provisioning and column ordering, task dates, pipeline consistency and direct status mutations.
- **17 integration tests passed** across three files on isolated **localhost:2021**, under Node **24.5.0**. They cover migration/database/storage/routes, real queued database-event functions, the deployed pipeline selection route, ordered empty stages, status actions preserving stage/pipeline/source/amount, and BRL defaults preserving an existing USD value.
- After the final direct-view provisioning adjustment, the two focused pipeline/status/currency integration cases were repeated and passed, including the deployed function path.
- **7 production configuration tests passed** under Node 24. Missing/example secrets, development configuration, local file storage, insecure public URLs, incomplete Lambda configuration and unacknowledged LOCAL execution are rejected. A test ensures the worker's Railway start override preserves the preflight entrypoint.
- Typecheck, lint and the production app package build (`twenty dev:build`) passed. The final app was applied locally. The metadata-only bootstrap plan reports **no changes** and does not replace live UI components with temporary shells.
- A reviewed sync removed **six obsolete sidebar shortcuts and five legacy view-group definitions only**. No object, field or business record was deleted. Subsequent syncs used `--no-delete`.
- The isolated API's 100 requests/minute limit remains enabled. Tests pace calls and honor 429 retry responses. Integration tests never uninstall the app and target only the isolated server. Their fixture IDs are randomly namespaced.
- Deployed logic bundles now use stable literal standard identifiers at runtime: SDK `define` exports are build-time stubs. The real deployed pipeline preparation route was exercised; native attachment file metadata uses the same corrected approach.

The development server uses Twenty v2.50.1 with SDK/UI/client packages 2.49.0. The Railway image is the official production v2.50.1 image, pinned by digest. Its frontend/server files and entrypoint were checked. The Docker build passed, and both the ordinary entrypoint and Railway-style overridden entrypoint passed preflight with synthetic configuration before executing Node 24.22.1. Missing configuration was rejected. These are packaging/startup checks; a real Railway database, bucket, SMTP and function runtime still need the production validation described in [RAILWAY.md](RAILWAY.md).

## Browser verification

The real Twenty interface was used:

- The main workspace has six work navigation entries: Negociações, Empresas, Contatos, Tarefas, Notas and Importar do RD Station. Native system controls remain available.
- Selecting a pipeline through **Funil / Filtros** opens its native kanban directly. In the isolated workspace, **Pré-vendas** showed Contato, Qualificação and Proposta, with the latter two empty. Switching to **Fechamento** showed only Demonstração and Negociação, both empty. No generic New/Screening/Meeting grouping or empty “No value” column was shown.
- Deals without a stage remain accessible in the native list; the filter panel explains how to assign a stage. No existing deal was silently assigned to a pipeline or stage.
- On a synthetic deal, Pausar → Retomar → Marcar perda → Marcar venda updated the status text, colored tag, card and native field immediately. Pipeline and stage remained unchanged, verified again through the API. Loading/saving states disable the actions; errors are visible.
- Actions remain at the top of the standard record summary, above native editable fields and contact/company/owner cards. Timeline, tasks, notes, files, email and the original full-details tab remain available.
- The new status action widget was checked in light and dark themes at the native 400px side-panel width. The original light preference was restored.
- A newly created synthetic opportunity inherited BRL and ONGOING. The currency integration test also verified that an existing USD amount was not converted.
- The main workspace was refreshed after metadata installation and continued to render its native pipeline and record panel. The dedicated import page retains its encrypted credential flow and exposes the native import archive through a button.

Main workspace evidence: [pipeline stage and sidebar](screenshots/native-pipeline-stages.png), [direct status actions](screenshots/native-deal-status-actions.png).

Isolated fixture evidence (its original navigation/preferences differ from the main workspace): [three ordered stages](screenshots/isolated-ordered-stages.png), [entirely empty second pipeline](screenshots/isolated-empty-pipeline.png), [won action](screenshots/isolated-status-won.png), [dark theme](screenshots/isolated-status-dark.png). All manually created UI fixtures and their views were removed; original isolated currency metadata was restored.

## Database safeguards and limits

The pre-change backup for this iteration is `.twenty/backups/before-pipeline-status.dump`. The comparison in [data-integrity-check.json](data-integrity-check.json) matches rows by ID and fields by column name, avoiding false differences from column ordering. It covers **5,550 existing records**: 599 companies, 1,200 people, 151 opportunities, 1,800 tasks and 1,800 notes. All pre-existing business values were identical; no rows were added, removed or changed in these five tables. No restore or direct SQL write was used. Workspace adjustments were performed through Twenty's metadata API; status actions change only the independent status field.

Native configuration snapshots are stored locally under `.twenty/backups/native-sales/<object-id>/`. They include original labels/layout settings, navigation, currency defaults and native views. Existing entity/option identifiers were preserved. Currency defaults apply to the PT-BR workspace; they do not implement automatic per-user currency switching when a user changes language.

The development container was stopped while the isolated tests ran to respect Docker's memory allocation, then restarted. Only the isolated server received disposable business fixtures. The application role has no business-record soft-delete or destroy permissions.

No real company-wide RD migration, customer token or paid AI inference was used. Source reconciliation, account-specific API coverage, original custom fields and attachment availability must still be reviewed against the customer's account. No RD data was changed. Production infrastructure was not created or deployed; real Railway, storage and function-driver validation remains a release gate.
