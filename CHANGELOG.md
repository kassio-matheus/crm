# Changelog

## Unreleased

### Native Twenty sales workspace correction — 2026-10-22

- Remove the hand-built kanban, list, record detail and duplicated data repository.
- Use native opportunity views, cards, drag and drop, inline editing and record side panels.
- Add a pinned filter action using transient native URL filters and sorts, without updating shared views.
- Add native pipeline/stage relations and one native saved board per imported pipeline, including ordered empty stages.
- Organize editable deal fields and native contact/company/owner cards; retain standard task, timeline, note, file and email actions.
- Maintain derived next-task dates and consistent pipeline relations with native database events.
- Group technical administration items and preserve the encrypted, resumable importer.
- Add an idempotent native workspace layout configuration with a local settings snapshot.

### Initial migration implementation — 2026-10-21

- Initially added an RD-inspired custom sales UI (replaced by native Twenty surfaces on 2026-10-22).
- Add independent ongoing/won/lost/paused status, pipeline/owner filters, sorting, qualification and date filters.
- Add native task/note creation and completion, owner assignment, stage movement and source audit views.
- Add an administrator import page, encrypted RD credentials and optional v1 history alongside v2 migration.
- Add paced background jobs, OAuth token rotation, durable atomic checkpoints, bounded retries and safe resume.
- Preserve source catalogs/custom data, import native CRM relations and copy supported attachments into Twenty storage.
- Add a read-only native AI sales coach and a metadata-first workspace setup command.
- Add unit, database, file-storage and authenticated route tests. Never uninstall the app during integration tests.
