import { randomUUID } from 'node:crypto';
import { afterAll, expect, it } from 'vitest';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { RecordImporter } from 'src/services/record-importer';
import { ImportPreviewLedger } from 'src/services/import-preview-ledger';
import { sourceId } from 'src/utils/source-id.util';

const core = new CoreApiClient();
const account = `test-preview-${randomUUID()}`;
const run = randomUUID();
const ledger = new ImportPreviewLedger(run, account, core);
const importer = new RecordImporter(ledger.client());
const id = (kind: string, external: string) => sourceId(`${account}:${kind}:${external}`);
const manualPerson = randomUUID();

afterAll(async () => {
  // Disposable fixtures on localhost:2021 only; never uninstall or address production data.
  const targets = [
    ['destroyTaskTarget', sourceId(`task-target:${account}:tasks:task`)],
    ['destroyNoteTarget', sourceId(`note-target:${account}:activities:note`)],
    ['destroyTask', id('tasks', 'task')], ['destroyNote', id('activities', 'note')],
    ['destroyOpportunity', id('deals', 'deal')], ['destroyPerson', manualPerson],
    ['destroyPerson', id('contacts', 'person')], ['destroyCompany', id('organizations', 'org')],
    ['destroyCompany', id('organizations', 'existing')],
  ];
  for (const [mutation, recordId] of targets) await core.mutation({ [mutation]: { __args: { id: recordId }, id: true } } as Parameters<CoreApiClient['mutation']>[0]);
  for (const prefix of [`${account}:`, `preview:${run}:`]) {
    const records = await core.query({ rdSourceRecords: { __args: { first: 100, filter: { sourceKey: { startsWith: prefix } } }, edges: { node: { id: true } } } });
    for (const edge of records.rdSourceRecords!.edges) await core.mutation({ destroyRdSourceRecord: { __args: { id: edge.node.id }, id: true } });
  }
});

it('records only new sample ownership, protects outside relationships, soft-deletes and restores native data', async () => {
  await new RecordImporter(core).import('organizations', { id: 'existing', name: 'Pre-existing fixture' }, account, 'older-run', false);
  expect(await importer.import('organizations', { id: 'existing', name: 'Must remain' }, account, run, false)).toBe('skipped');
  await importer.import('organizations', { id: 'org', name: 'Recent sample company' }, account, run, false);
  await importer.import('contacts', { id: 'person', name: 'Recent sample person', organization_id: 'org' }, account, run, false);
  await importer.import('deals', { id: 'deal', name: 'Recent sample deal', organization_id: 'org', contact_ids: ['person'], amount_total: 123.45 }, account, run, false);
  await importer.import('tasks', { id: 'task', name: 'Recent sample task', deal_id: 'deal' }, account, run, false);
  await importer.import('activities', { id: 'note', text: 'Recent sample note', deal_id: 'deal' }, account, run, false);
  const owned = await ledger.entries();
  expect(owned).toHaveLength(7);
  expect(owned.some((entry) => entry.owned.id === id('organizations', 'existing'))).toBe(false);

  await core.mutation({ createPerson: { __args: { data: { id: manualPerson, name: { firstName: 'Outside sample' }, companyId: id('organizations', 'org') } }, id: true } });
  await expect(ledger.cleanup(async () => {})).rejects.toThrow('RD_PREVIEW_IN_USE');
  const before = await core.query({ opportunities: { __args: { filter: { id: { eq: id('deals', 'deal') } } }, edges: { node: { id: true } } } });
  expect(before.opportunities!.edges).toHaveLength(1);
  await core.mutation({ deletePerson: { __args: { id: manualPerson }, id: true } });

  await ledger.cleanup(async () => {});
  const removed = await core.query({ companies: { __args: { filter: { id: { in: [id('organizations', 'org'), id('organizations', 'existing')] } } }, edges: { node: { id: true } } }, opportunities: { __args: { filter: { id: { eq: id('deals', 'deal') } } }, edges: { node: { id: true } } } });
  expect(removed.companies!.edges.map((edge) => edge.node.id)).toEqual([id('organizations', 'existing')]);
  expect(removed.opportunities!.edges).toEqual([]);
  expect((await ledger.entries()).every((entry) => entry.owned.deleted)).toBe(true);

  await ledger.restore();
  const restored = await core.query({ opportunities: { __args: { filter: { id: { eq: id('deals', 'deal') } } }, edges: { node: { id: true, companyId: true, pointOfContactId: true, amount: { amountMicros: true } } } }, taskTargets: { __args: { filter: { taskId: { eq: id('tasks', 'task') } } }, edges: { node: { targetOpportunityId: true } } } });
  expect(restored.opportunities!.edges).toHaveLength(1);
  expect(restored.opportunities!.edges[0].node).toMatchObject({ companyId: id('organizations', 'org'), pointOfContactId: id('contacts', 'person'), amount: { amountMicros: 123450000 } });
  expect(restored.taskTargets!.edges).toHaveLength(1);
  expect(await new RecordImporter(core).import('deals', { id: 'deal', name: 'Stale source' }, account, 'full-run', false)).toBe('skipped');
});
