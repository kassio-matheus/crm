# Twenty Sales CRM

An additive Twenty app focused on RD Station-style sales pipelines and a resumable RD Station CRM migration. Source code and internal identifiers are English; the workspace UI is Portuguese.

## Use the app

Open **Negociações** in the Twenty sidebar for the board/list, pipeline, owner, status and ordering controls. Open a deal for its stage ribbon, owner, contact/company, pending tasks, notes, imported products and files. Status is independent from pipeline stage. Native opportunities, people, companies, tasks and notes remain available in Twenty's regular screens.

Open **Importar RD Station** as a workspace administrator. Save the credentials, run the simulation, review its result, then start the import. Pause and resume from the same page. The page reports a failed/stalled worker as resumable rather than leaving it running forever.

Use **Priorizar com IA** for recommendations through Twenty's native AI agent. Configure a model and credits in Twenty first. The app's sales coach role has read access only; recommendations never change a deal automatically. Up to 200 selected/filtered opportunities are analyzed per request.

## Migration coverage

| Data                                                             | Destination                                                                                                                                           |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organizations and contacts                                       | Native companies and people, including company relationship, emails and phones                                                                        |
| Deals                                                            | Native opportunities, company, primary contact, matching native owner, amount, forecast, original creation date, qualification and independent status |
| Pipelines and stages                                             | Preserved reference records used by the custom board, retaining order and pipeline membership                                                         |
| Tasks, including completed tasks                                 | Native tasks and links to their deals                                                                                                                 |
| Notes/history exposed as v1 activities                           | Native notes linked to their deals                                                                                                                    |
| Users without a matching Twenty email                            | Original owner ID/name retained; no users are invited automatically                                                                                   |
| Products, campaigns, sources, loss reasons, teams, custom fields | Original structured source snapshots in **Registros RD Station**                                                                                      |
| Deal products and additional contacts                            | Deal-scoped source snapshots, preserving associations                                                                                                 |
| API v2 meetings, meeting availability and proposals              | Original structured source snapshots                                                                                                                  |
| API v2 attachments                                               | Native attachments and binary copies linked to the deal; up to 50 MB each                                                                             |

Keep the source CRM read-only during the migration/reconciliation window; list pagination cannot provide a transactionally consistent snapshot of a company that is being edited. The importer requests stable creation-date ordering for the main lists and detects changed pages during recovery.

Use a CRM administrator token that can read the entire source company. API v1 and v2 are different products from RD Station Marketing and use different credentials. V2 requires the access token, refresh token, client ID and client secret; refreshed token pairs are saved together in an encrypted Twenty application variable.

API v1 cannot guarantee complete listing beyond 10,000 records. This app fails explicitly at that boundary; it does not label a potentially truncated import complete. API v2 is recommended for large datasets. V1 exposes activities that v2 does not currently expose; v2 exposes attachments/proposals that v1 does not. A v2 run can also import v1 activities and legacy stage history when the optional v1 token for the same company is provided on the page. Email contents, questionnaires, original access permissions and resources absent from the chosen API are **not** migrated. Do not cancel RD until the coverage/reconciliation has been reviewed against the source company.

This is a one-time, create-only migration, not bidirectional synchronization. It never updates an already imported native business record or merges existing records by email/name. Native edits survive retries. Repeated external IDs are scoped to the company and resource kind; child products/files are also scoped to their deal. Preserve the company key and API version throughout a migration. The UI requires a completed simulation before live import.

Original payloads are retained for reconciliation, with secret-looking fields removed recursively. Metadata/custom data retained as snapshots is not automatically converted into arbitrary Twenty field definitions. Additional deal contacts remain available in the archive; only the primary contact becomes Twenty's point of contact.

## Safety and recovery

- No uninstall, SQL migrations, direct SQL writes, record deletion or destructive role is used by the importer.
- Deterministic IDs and unique source keys protect against duplicate business records on page/job retries.
- A source archive is marked complete only after its native writes and relationship links succeed.
- One queued page is processed per run; its record offset and counters are saved atomically in one progress record after each successful record. Changed source-page IDs on recovery fail explicitly.
- The queue uses stable checkpoint IDs to deduplicate duplicate commands while retained by Twenty.
- Requests are paced at least 800 ms apart (about 75/minute), below RD's 120/minute allowance. Other integrations sharing the account also consume that allowance; 429 responses honor Retry-After and back off at least a minute. Automatic retries stop after three unsuccessful retries of a page.
- Credentials are saved only as an encrypted secret application variable. Jobs/checkpoints contain no API credentials. RD error response bodies and URLs are not returned to the UI.
- Signed file URLs must be HTTPS on the supported RD/AWS/CDN domains. Redirects, unknown hosts, oversized files and incomplete downloads stop that resource rather than silently skipping it. An interrupted upload before its receipt is persisted can leave an unlinked storage blob; it cannot create a duplicate deal/attachment record.
- Simulation validates source listing/projection and conflicts with existing primary contact emails, without writing business records or source snapshots. It stores a technical progress record and job state. Deal-scoped details/attachments are copied during the live run; the simulation is not a substitute for source reconciliation.

Create a PostgreSQL backup before installing into a populated workspace. `yarn twenty plan` is read-only. Apply with `yarn twenty apply --no-delete` to preserve remote entities absent from a partial source checkout. Never uninstall this app to roll back: uninstall removes its owned metadata and source snapshots. Redeploy a prior Git checkpoint with `--no-delete`, and restore a database backup only through an explicitly planned restore procedure.

## Development

See [SETUP.md](SETUP.md) and [docs/VALIDATION.md](docs/VALIDATION.md).

```sh
yarn install --immutable
yarn setup:workspace     # metadata first, generate SDK, then full app
yarn twenty plan
yarn twenty apply --no-delete
yarn test:unit
yarn typecheck
yarn lint
yarn test               # isolated localhost:2021 only; never uninstalls the app
```

The official Twenty agent skills are installed locally under `.agents/skills/`. The RD documentation MCP is configured in the ignored `.codex/config.toml`; reload the agent session to discover it. Neither configuration contains an RD account token.

Primary references: [Twenty app documentation](https://docs.twenty.com/developers/extend/apps/getting-started/quick-start), [RD CRM v1 limits](https://developers.rdstation.com/reference/crm-v1-introducao-e-requisitos), [RD CRM v2 pagination and limits](https://developers.rdstation.com/reference/crm-v2-introduction), [OAuth token renewal](https://developers.rdstation.com/reference/crm-v2-authentication-step-4).
