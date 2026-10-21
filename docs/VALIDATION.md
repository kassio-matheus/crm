# Validation record — 2026-10-21

The implementation is an additive Twenty app, not a fork of Twenty's server. The final migration uses native CRM records and preserves unsupported source structures as audit snapshots. It does not remove database records or owned metadata.

## Automated checks

- **105 unit tests passed** across 18 files: status mapping; UUID determinism and namespaces; secret redaction; credential validation; source data/money/date/clock mapping; every ordering mode; v1/v2 HTTP contracts; rate-limit/Retry-After handling; OAuth rotation; hostile pagination URLs; the 10,000-record v1 boundary; source relationship recovery; upload size/truncation checks; command deduplication; paused/failed/timed-out workers; atomic counters/offsets; changed-source-page detection; paginated board reads; retry-safe tasks/notes; and native AI request validation.
- **12 integration tests passed** against PostgreSQL and file storage at isolated `localhost:2021`: stable app registration; linked company/contact/deal migration; exact currency amounts; preserving local edits on replay; every independent status; simulation without business writes; invalid data rejection before writes; recovery from a missing company relation; retry-safe task/note links; conflicting contact email preservation; real binary upload into Twenty with one attachment link; and authenticated/unauthenticated import routes.
- Typecheck, lint and the full unit suite also passed under Node 24.5.0, matching `.nvmrc`. The metadata plan reported **zero entities to destroy**. All syncs used `--no-delete`.
- The metadata-first setup script was executed against the isolated instance. It preserved stable IDs, generated the SDK and restored the complete UI after its temporary page shells.

## Browser verification

Verified in the actual Twenty remote-DOM renderer on localhost:2020:

- Sales board mounts and loads all pages of the seeded dataset (129 ongoing deals).
- The Won filter displays 21 sold deals in the Customer stage.
- The list view displays real company, stage, owner, status and currency values.
- The deal detail renders its stage ribbon, owner, contact/company, task form and note/task/product/file tabs.
- The dedicated import page renders the v1/v2 credentials, optional legacy history token, encrypted save flow, simulation/start/pause/resume controls and progress states.
- The original function-management lookup failed in a front component. It was replaced by authenticated app HTTP routes, then verified in the browser and with integration tests.

Browser evidence: [sales board](screenshots/sales-board.png) and [import page](screenshots/rd-import.png). The final board uses independent column scrolling. Light mode and the narrow in-app browser viewport were verified; a visual dark-mode pass remains separate from the semantic theme-token implementation.

## Database and environment safeguards

A PostgreSQL custom-format backup is stored locally at `.twenty/backups/before-rd-crm.dump` (ignored by Git). The pre-existing `yarn twenty dev` watcher was interrupted so incomplete edits could not continue synchronizing.

The separate test image initially failed to initialize its core schema. The isolated test database was recovered from a copy of the backup; the development database was not restored. Two all-in-one containers exceeded the Docker VM's roughly 4 GB memory allowance during one test run. The development container was temporarily stopped for the final isolated suite, then restarted; the test container was stopped afterwards.

The real file-storage test exposed a Twenty 2.49 SDK issue: `CoreApiClient.uploadFile` sends upload mutations to `/graphql`, while the server exposes them on `/metadata`. The importer now uses the typed metadata client for initiating/completing uploads and the core client for attachment records. A real text-file upload and link passed afterwards.

The app role is limited to the required sales objects, source snapshots, reading workspace members and specific application/AI/file capabilities. It has no soft-delete or destroy permission. The AI coach has read access only to opportunities, tasks and task links.

## Validation still requiring customer configuration

No real RD company credential was supplied. A live company-wide migration, source/target count reconciliation and source-specific custom-field review therefore remain to be performed through the import page. Tests use official API contracts and controlled responses; they cannot establish the customer's API scopes, plan availability, file-host domains, source duplicates or dataset completeness.

The native AI's provider/model/credit configuration was not invoked against a paid model. Its role, input contract and integration are built and tested; real inference depends on the instance's AI configuration.

Keep RD read-only during the migration window. Review source/target counts and archived unsupported structures before cancelling RD. API coverage, v1 limits, file size/domain constraints and intentionally unsupported resources are documented in the README; a completed source listing is not a claim that unavailable email contents or permissions were transferred.
