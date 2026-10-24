import { randomUUID } from 'node:crypto';
import { afterAll, expect, it } from 'vitest';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { RecordImporter } from 'src/services/record-importer';
import { ImportOwners } from 'src/services/import-owners';
import { ImportPreviewLedger } from 'src/services/import-preview-ledger';
import { sourceId } from 'src/utils/source-id.util';

const core = new CoreApiClient();
const account = `test-owners-${randomUUID()}`;
const run = randomUUID();
const ledger = new ImportPreviewLedger(run, account, core);
const importer = new RecordImporter(ledger.client());
const nativeId = (kind: string) => sourceId(`${account}:${kind}:fixture`);

afterAll(async () => {
  for (const [mutation, kind] of [
    ['destroyTask', 'tasks'],
    ['destroyOpportunity', 'deals'],
    ['destroyCompany', 'organizations'],
  ]) {
    await core.mutation({
      [mutation]: { __args: { id: nativeId(kind) }, id: true },
    } as Parameters<CoreApiClient['mutation']>[0]);
  }
  for (const prefix of [`${account}:`, `preview:${run}:`]) {
    const result = await core.query({
      rdSourceRecords: {
        __args: { first: 100, filter: { sourceKey: { startsWith: prefix } } },
        edges: { node: { id: true } },
      },
    });
    for (const { node } of result.rdSourceRecords!.edges)
      await core.mutation({
        destroyRdSourceRecord: { __args: { id: node.id }, id: true },
      });
  }
});

it('assigns owners by email, fills null owners on replay, preserves manual owners and retains sample receipts', async () => {
  const members = await core.query({
    workspaceMembers: {
      __args: { first: 1 },
      edges: { node: { id: true, userEmail: true } },
    },
  });
  const member = members.workspaceMembers!.edges[0].node;
  expect(member.userEmail).toBeTruthy();
  await importer.import(
    'users',
    {
      id: 'rd-owner',
      name: 'Fixture owner',
      email: member.userEmail!.toUpperCase(),
    },
    account,
    run,
    false,
  );
  for (const kind of ['organizations', 'deals', 'tasks']) {
    await importer.import(
      kind,
      {
        id: 'fixture',
        name: 'Owner fixture',
        ...(kind === 'organizations'
          ? { owner_id: 'rd-owner' }
          : kind === 'tasks'
            ? { owner_ids: ['rd-owner'] }
            : {}),
      },
      account,
      run,
      false,
    );
  }
  const receipts = await ledger.entries();
  expect(receipts).toHaveLength(3);
  const read = () =>
    core.query({
      companies: {
        __args: { filter: { id: { eq: nativeId('organizations') } } },
        edges: { node: { accountOwnerId: true } },
      },
      opportunities: {
        __args: { filter: { id: { eq: nativeId('deals') } } },
        edges: { node: { ownerId: true, name: true } },
      },
      tasks: {
        __args: { filter: { id: { eq: nativeId('tasks') } } },
        edges: { node: { assigneeId: true } },
      },
    });
  expect((await read()).companies!.edges[0].node.accountOwnerId).toBe(
    member.id,
  );
  expect((await read()).tasks!.edges[0].node.assigneeId).toBe(member.id);
  expect((await read()).opportunities!.edges[0].node.ownerId).toBeNull();
  for (const kind of ['organizations', 'deals', 'tasks']) {
    expect(
      await importer.import(
        kind,
        {
          id: 'fixture',
          owner_id: 'rd-owner',
          ...(kind === 'tasks' ? { owner_ids: ['rd-owner'] } : {}),
        },
        account,
        'larger-sample',
        false,
      ),
    ).toBe('skipped');
  }
  const assigned = await read();
  expect(assigned.companies!.edges[0].node.accountOwnerId).toBe(member.id);
  expect(assigned.opportunities!.edges[0].node.ownerId).toBe(member.id);
  expect(assigned.tasks!.edges[0].node.assigneeId).toBe(member.id);
  expect((await ledger.entries()).map((entry) => entry.receiptId)).toEqual(
    receipts.map((entry) => entry.receiptId),
  );
  // Simulate a manual assignment winning before the importer's conditional write.
  await core.mutation({
    updateOpportunity: {
      __args: {
        id: nativeId('deals'),
        data: { name: 'Manual edit preserved', ownerId: member.id },
      },
      id: true,
    },
  });
  await new ImportOwners(core).fillMissing(
    'deals',
    `${account}:deals:fixture`,
    randomUUID(),
  );
  const unchanged = await read();
  expect(unchanged.opportunities!.edges[0].node).toMatchObject({
    ownerId: member.id,
    name: 'Manual edit preserved',
  });
  // A wrong canonical key must not select the target, even if the owner is empty.
  await new ImportOwners(core).fillMissing(
    'deals',
    `${account}:deals:another`,
    randomUUID(),
  );
  expect((await read()).opportunities!.edges).toHaveLength(1);
});
