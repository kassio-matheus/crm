import { randomUUID } from 'node:crypto';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { AttachmentImporter } from 'src/services/attachment-importer';
import { RecordImporter } from 'src/services/record-importer';
import { sourceId } from 'src/utils/source-id.util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const client = new CoreApiClient();
const importer = new RecordImporter(client);
const account = `test-${randomUUID()}`;
const nativeId = (kind: string, id: string) =>
  sourceId(`${account}:${kind}:${id}`);
const cleanup: { kind: string; id: string }[] = [];

afterAll(async () => {
  // Only fixtures with this run's random account are destroyed. The app is never uninstalled.
  for (const item of cleanup.reverse()) {
    if (item.kind === 'attachments')
      await client.mutation({
        destroyAttachment: { __args: { id: item.id }, id: true },
      });
    if (item.kind === 'deals')
      await client.mutation({
        destroyOpportunity: { __args: { id: item.id }, id: true },
      });
    if (item.kind === 'contacts')
      await client.mutation({
        destroyPerson: { __args: { id: item.id }, id: true },
      });
    if (item.kind === 'organizations')
      await client.mutation({
        destroyCompany: { __args: { id: item.id }, id: true },
      });
    if (item.kind === 'tasks')
      await client.mutation({
        destroyTask: { __args: { id: item.id }, id: true },
      });
    if (item.kind === 'activities')
      await client.mutation({
        destroyNote: { __args: { id: item.id }, id: true },
      });
  }
  const archives = await client.query({
    rdSourceRecords: {
      __args: {
        first: 100,
        filter: { sourceKey: { startsWith: `${account}:` } },
      },
      edges: { node: { id: true } },
    },
  });
  for (const { node } of archives.rdSourceRecords!.edges)
    await client.mutation({
      destroyRdSourceRecord: { __args: { id: node.id }, id: true },
    });
});

describe('Additive Twenty installation', () => {
  it('registers the app with its original stable identifier', async () => {
    const result = await new MetadataApiClient().query({
      findManyApplications: { universalIdentifier: true },
    });
    expect(
      result.findManyApplications.some(
        (a) => a.universalIdentifier === APPLICATION_UNIVERSAL_IDENTIFIER,
      ),
    ).toBe(true);
  });
});

describe('Database-backed migration', () => {
  beforeAll(async () => {
    await importer.import(
      'organizations',
      { id: 'org', name: 'Integration company', custom: { retained: true } },
      account,
      'test',
      false,
    );
    cleanup.push({
      kind: 'organizations',
      id: nativeId('organizations', 'org'),
    });
    await importer.import(
      'contacts',
      {
        id: 'person',
        name: 'Maria da Silva',
        organization_id: 'org',
        emails: [{ email: `${account}@example.invalid` }],
      },
      account,
      'test',
      false,
    );
    cleanup.push({ kind: 'contacts', id: nativeId('contacts', 'person') });
    await importer.import(
      'deals',
      {
        id: 'deal',
        name: 'Integration sale',
        amount_total: 399.83,
        win: null,
        organization: { id: 'org' },
        contacts: [{ id: 'person' }],
        created_at: '2020-01-01T00:00:00Z',
        deal_custom_fields: [{ value: 'kept' }],
      },
      account,
      'test',
      false,
    );
    cleanup.push({ kind: 'deals', id: nativeId('deals', 'deal') });
  });
  it('preserves native company and contact relationships and exact money', async () => {
    const result = await client.query({
      opportunities: {
        __args: { filter: { id: { eq: nativeId('deals', 'deal') } } },
        edges: {
          node: {
            id: true,
            companyId: true,
            pointOfContactId: true,
            amount: { amountMicros: true },
            rdCreatedAt: true,
            rdOriginalData: true,
          },
        },
      },
    });
    expect(result.opportunities!.edges).toHaveLength(1);
    expect(result.opportunities!.edges[0].node).toMatchObject({
      companyId: nativeId('organizations', 'org'),
      pointOfContactId: nativeId('contacts', 'person'),
      amount: { amountMicros: 399830000 },
      rdCreatedAt: '2020-01-01T00:00:00.000Z',
      rdOriginalData: { deal_custom_fields: [{ value: 'kept' }] },
    });
  });
  it('does not duplicate or overwrite local changes on replay', async () => {
    const id = nativeId('deals', 'deal');
    await client.mutation({
      updateOpportunity: {
        __args: {
          id,
          data: { name: 'Edited in Twenty', dealStatus: 'PAUSED' },
        },
        id: true,
      },
    });
    expect(
      await importer.import(
        'deals',
        { id: 'deal', name: 'Stale source name', amount_total: 0 },
        account,
        'retry',
        false,
      ),
    ).toBe('skipped');
    const result = await client.query({
      opportunities: {
        __args: { filter: { rdSourceKey: { eq: `${account}:deals:deal` } } },
        edges: {
          node: {
            name: true,
            dealStatus: true,
            amount: { amountMicros: true },
          },
        },
      },
    });
    expect(result.opportunities!.edges).toHaveLength(1);
    expect(result.opportunities!.edges[0].node).toMatchObject({
      name: 'Edited in Twenty',
      dealStatus: 'PAUSED',
      amount: { amountMicros: 399830000 },
    });
  });
  it('supports all requested deal statuses without removing the stage', async () => {
    const id = nativeId('deals', 'deal');
    for (const dealStatus of ['ONGOING', 'WON', 'LOST', 'PAUSED'] as const) {
      await client.mutation({
        updateOpportunity: { __args: { id, data: { dealStatus } }, id: true },
      });
      const result = await client.query({
        opportunities: {
          __args: { filter: { id: { eq: id } } },
          edges: { node: { dealStatus: true, stage: true } },
        },
      });
      expect(result.opportunities!.edges[0].node.dealStatus).toBe(dealStatus);
      expect(result.opportunities!.edges[0].node.stage).toBeTruthy();
    }
  });
  it('does not write business records or archives during simulation', async () => {
    await importer.import(
      'organizations',
      { id: 'simulated', name: 'Simulation only' },
      account,
      'test',
      true,
    );
    const result = await client.query({
      rdSourceRecords: {
        __args: {
          filter: { sourceKey: { eq: `${account}:organizations:simulated` } },
        },
        edges: { node: { id: true } },
      },
    });
    expect(result.rdSourceRecords!.edges).toEqual([]);
  });
  it('rejects malformed records before creating an archive', async () => {
    await expect(
      importer.import(
        'deals',
        { id: 'invalid', amount_total: NaN },
        account,
        'test',
        false,
      ),
    ).rejects.toThrow('amount');
    const result = await client.query({
      rdSourceRecords: {
        __args: { filter: { sourceKey: { eq: `${account}:deals:invalid` } } },
        edges: { node: { id: true } },
      },
    });
    expect(result.rdSourceRecords!.edges).toEqual([]);
  });
  it('recovers a partial write without losing its company relationship', async () => {
    const record = {
      id: 'partial',
      name: 'Partial contact',
      organization_id: 'late-org',
    };
    await expect(
      importer.import('contacts', record, account, 'test', false),
    ).rejects.toThrow('Missing imported');
    await importer.import(
      'organizations',
      { id: 'late-org', name: 'Late company' },
      account,
      'test',
      false,
    );
    cleanup.push({
      kind: 'organizations',
      id: nativeId('organizations', 'late-org'),
    });
    await importer.import('contacts', record, account, 'retry', false);
    cleanup.push({ kind: 'contacts', id: nativeId('contacts', 'partial') });
    const result = await client.query({
      people: {
        __args: { filter: { id: { eq: nativeId('contacts', 'partial') } } },
        edges: { node: { companyId: true } },
      },
    });
    expect(result.people!.edges[0].node.companyId).toBe(
      nativeId('organizations', 'late-org'),
    );
  });
  it('links tasks and notes exactly once across retries', async () => {
    const task = {
      id: 'task',
      subject: 'Call customer',
      deal_id: 'deal',
      date: '2026-11-01T12:00:00Z',
      done: true,
    };
    const note = { id: 'note', text: 'Imported history', deal_id: 'deal' };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await importer.import('tasks', task, account, 'test', false);
      await importer.import('activities', note, account, 'test', false);
    }
    cleanup.push(
      { kind: 'tasks', id: nativeId('tasks', 'task') },
      { kind: 'activities', id: nativeId('activities', 'note') },
    );
    const result = await client.query({
      taskTargets: {
        __args: { filter: { taskId: { eq: nativeId('tasks', 'task') } } },
        edges: { node: { targetOpportunityId: true } },
      },
      noteTargets: {
        __args: { filter: { noteId: { eq: nativeId('activities', 'note') } } },
        edges: { node: { targetOpportunityId: true } },
      },
    });
    expect(result.taskTargets!.edges).toHaveLength(1);
    expect(result.noteTargets!.edges).toHaveLength(1);
    expect(result.taskTargets!.edges[0].node.targetOpportunityId).toBe(
      nativeId('deals', 'deal'),
    );
    expect(result.noteTargets!.edges[0].node.targetOpportunityId).toBe(
      nativeId('deals', 'deal'),
    );
  });
  it('stops on a conflicting contact email without merging or overwriting the existing contact', async () => {
    await expect(
      importer.import(
        'contacts',
        {
          id: 'conflict',
          name: 'Different source contact',
          emails: [{ email: `${account}@example.invalid` }],
        },
        account,
        'test',
        false,
      ),
    ).rejects.toThrow('RD_CONTACT_EMAIL_CONFLICT');
    const people = await client.query({
      people: {
        __args: {
          filter: {
            emails: { primaryEmail: { eq: `${account}@example.invalid` } },
          },
        },
        edges: { node: { id: true, name: { firstName: true } } },
      },
    });
    expect(people.people!.edges).toHaveLength(1);
    expect(people.people!.edges[0].node.name?.firstName).toBe('Maria');
  });
  it('copies a binary into native Twenty file storage and links it exactly once', async () => {
    const id = nativeId('attachments', 'file');
    const store = {
      get: async <T>(): Promise<T | null> => null,
      set: async () => {},
    };
    const transfer = new AttachmentImporter(
      client,
      async () => new Response('fixture bytes'),
      store,
    );
    const record = {
      name: 'migration-test.txt',
      size: 13,
      url: 'https://bucket.s3.amazonaws.com/fixture',
    };
    await transfer.import(record, id, nativeId('deals', 'deal'));
    cleanup.push({ kind: 'attachments', id });
    expect(await transfer.import(record, id, nativeId('deals', 'deal'))).toBe(
      false,
    );
    const response = await client.query({
      attachments: {
        __args: { filter: { id: { eq: id } } },
        edges: {
          node: {
            id: true,
            targetOpportunityId: true,
            file: { fileId: true, label: true },
          },
        },
      },
    });
    expect(response.attachments!.edges).toHaveLength(1);
    expect(response.attachments!.edges[0].node.targetOpportunityId).toBe(
      nativeId('deals', 'deal'),
    );
    expect(response.attachments!.edges[0].node.file?.[0]?.label).toBe(
      'migration-test.txt',
    );
  });
});

describe('Authenticated app routes', () => {
  it('rejects unauthenticated import control requests', async () => {
    const result = await fetch(`${process.env.TWENTY_API_URL}/s/rd-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'status' }),
    });
    expect([401, 403]).toContain(result.status);
  });
  it('reads import progress through the authenticated route without listing workspace functions', async () => {
    const result = await fetch(`${process.env.TWENTY_API_URL}/s/rd-import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.TWENTY_API_KEY}`,
      },
      body: JSON.stringify({ action: 'status' }),
    });
    const body = await result.text();
    expect(result.status, body.slice(0, 300)).toBe(200);
    expect(body).not.toContain('does not have permission');
  });
});
