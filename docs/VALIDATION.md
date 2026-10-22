# Validation record — 2026-10-22

The sales workspace now uses Twenty's native kanban, table, record side panel, field widgets, relation cards and activity tabs. The former hand-built kanban, list, detail component and full-dataset repository have been removed. The encrypted, resumable RD importer is preserved.

## Automated checks

- **132 unit tests passed** across 23 files. Coverage includes migration recovery, credential handling, RD limits and pagination, native filter serialization, catalog-only pagination, create-only native pipeline views and ordered groups, task-date derivation and pipeline/stage consistency.
- **14 migration/database/storage/route integration tests passed** on isolated `localhost:2021`, including native pipeline/stage relationships, source preservation after stage moves and next-task ordering.
- **1 additional integration test passed** using the actual queued database-event functions. Creating/linking a pending task populated its opportunity's next-task date; completing it cleared the date; changing a stage synchronized its pipeline while preserving commercial status and the original RD stage key.
- Unit tests, the database-event test and final typecheck passed under Node **24.5.0**. Lint passed with no errors. The full migration suite also passed on the host's Node 26 runtime; the installed Yarn launcher uses a fixed interpreter, so Node 24 validation invokes that launcher through Node explicitly.
- Every app sync used `--no-delete`. The final visual polish changed one front component with **0 entities to destroy**. Marking the derived next-task field non-editable also removed its automatically generated creation-form widget; no CRM field or business record was removed.
- The isolated API key's real 100 requests/minute limit remains enabled. Tests pace calls and honor 429 responses. Fixture cleanup handles this server's Boolean `deleteView` result despite the SDK's older return type.
- The 37 owned fixtures left by two interrupted test runs were removed from the isolated server using their random test account namespaces. Development records were excluded.

## Browser verification

Verified through the actual Twenty UI, rather than a standalone mockup:

- The primary Negociações navigation opens the native opportunity route and kanban. Technical app entries are grouped separately.
- The pinned Filtros command opens the side panel and loads catalogs without downloading every opportunity.
- Applying the ongoing status changes native filters and column results. Twenty offers its normal Reset/Update view actions; the app does not save a shared view.
- The native record side panel opens from a card with editable sales fields, native contact/company/owner cards and the standard activity tabs. The original complete details remain available.
- An imported fixture pipeline opens as a native saved view, groups by its related stage record and shows native status/company/owner/amount fields.
- Light and dark themes and a narrow viewport were checked. Filter controls retain visible labels and themed outlines; the original light preference was restored.
- The importer remains a dedicated page. Actual customer RD credentials and paid AI inference were not used.

Evidence: [native board](screenshots/sales-board.png), [native record side panel](screenshots/native-sales-side-panel.png), [filters](screenshots/native-sales-filters.png), [dark theme](screenshots/native-sales-filters-dark.png), [isolated imported fixture pipeline](screenshots/native-imported-pipeline.png), and [import page](screenshots/rd-import.png).

## Database safeguards and limits

A read-only comparison against the pre-change backup verified **5,549 existing business records** (599 companies, 1,200 people, 150 opportunities, 1,800 tasks and 1,800 notes). Every pre-existing field value was unchanged; no record was missing or added in these tables. New nullable relation columns were excluded from the comparison. See [the integrity report](data-integrity-check.json).

The local PostgreSQL backup before this correction is `.twenty/backups/before-native-sales.dump`; the initial migration backup is `.twenty/backups/before-rd-crm.dump`. Both are ignored by Git. The native layout configuration also saves its original settings locally and is idempotent. Native API metadata exposes the base record-opening enum on this server even when the workspace override is stored; the configuration retains a local receipt, and side-panel behavior was verified in the UI.

Only the isolated test server received disposable business fixtures. The development container was stopped while the isolated tests ran to stay within Docker's memory allocation, then restarted. No database restore or direct SQL write was used for this correction. The app role has no business-record soft-delete or destroy permissions; derived-field functions update only the next-task date or pipeline/stage consistency.

No live company-wide RD migration was performed because no customer API credentials were supplied. API scopes, source/target reconciliation, source-specific custom fields, attachment availability and the existing migration coverage limits still require validation against the customer's account. Source structures retained as snapshots are not automatically converted into arbitrary native fields or commerce modules. Twenty AI model/provider/credits still require instance configuration.

The RD browser session was inspected read-only. No RD records, tasks, statuses or values were changed.
