# Native sales controls

Twenty v2.50.1 remains the host for cards, drag and drop, grouping, navigation,
record fields, confirmation dialogs and permissions. The pinned adapter in
`deploy/native-ui/` adds operational controls; it does not replace the board.

## Selecting a phase

Each sales-stage column has a **Selecionar fase** button. It opens **Ações em
massa** for that phase AND every current board criterion (pipeline, owner,
status and search). Selection paginates the Twenty API, including records not
loaded in the board. Empty selections cannot execute a write.

The panel freezes record IDs before writes. Moving/deleting records cannot
change the next input page, and newly created copies cannot become input to
the same duplication operation. Batches contain at most 25 records. The server
must confirm the exact IDs in each batch before progress advances. Partial
failures stop the operation and disable replay from that panel. Completed
batches are retained; review records before creating another operation.

Actions appear in this order:

1. Change pipeline, with a required destination stage.
2. Change sales stage.
3. Duplicate.
4. Soft delete to Twenty's recoverable trash.
5. Update other fields, in a collapsed native field form.

Pipeline/stage moves re-read the destination stage immediately before writing
and set both native relations together. All writes use the signed-in user's
Twenty API permissions. No elevated application token is used by the adapter.

Duplication copies editable business values and many-to-one relations, including
the owner. It creates new IDs and excludes system fields, unique values,
import identity keys, original RD snapshots and child collections. Tasks, notes,
attachments and import cleanup receipts are not cloned. No RD endpoint is used.

## Pipeline filters and retired fields

The native **Filtrar negociações** command opens a dedicated native side panel.
It initializes pipeline/stage/owner/status from the active board and offers
searchable native dropdowns, dependent stages, a live count, sorting and board/
list navigation. Applying criteria updates the URL; it does not edit a shared
view or business record. Clearing criteria retains the selected pipeline.

The standard advanced-filter stage picker also restricts candidates to the
selected pipeline. Board columns are restricted to that catalog and intersected
with the selected stage. Empty stages remain visible unless a stage filter
excludes them.

The old opportunity `stage` selector (New, Screening, Meeting, Proposal,
Customer) and technical `salesPipelineKey` / `salesStageKey` references are
excluded from operational forms, details, table/card field visibility and filter
choices. Their database fields and historical values remain available to the
importer and legacy compatibility logic. Actual salesPipeline/salesStage
relations and commercial dealStatus remain available. Fields named stage on
other objects are unaffected.

## Installation and verification

The Railway Dockerfile applies the adapter while building the digest-pinned
official image. Every modified upstream bundle must match its pinned SHA-256.
All replacements are checked before any file is written; unsupported releases
fail the build. Asset URLs change and a receipt verifies all adapted bundles.
Update the supported release explicitly rather than weakening these checks.

```sh
yarn test:unit
yarn typecheck
yarn lint
yarn test:deployment
```

To additionally check anchors against an untouched frontend copied from the
pinned official image:

```sh
TWENTY_FRONT_FIXTURE=/path/to/front node --test deploy/native-ui/*.test.mjs
```

Use `yarn configure:native-host <test-container>` only against an unmodified
matching frontend. To iterate, restore that test container's private frontend
backup before applying again, or recreate the isolated container. Never delete
production records or change RD data to test these controls.
