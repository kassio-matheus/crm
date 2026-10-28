import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { RecordImporter } from '../record-importer';
import { sourceId } from 'src/utils/source-id.util';
vi.mock('src/services/native-pipeline-views', () => ({
  NativePipelineViews: class {
    ensure = vi.fn().mockResolvedValue(undefined);
    addStage = vi.fn().mockResolvedValue(undefined);
  },
}));
const query = vi.fn();
const mutation = vi.fn();
const client = { query, mutation } as unknown as CoreApiClient;
beforeEach(() => {
  query.mockReset();
  mutation.mockReset();
  mutation.mockResolvedValue({});
});
describe('RecordImporter', () => {
  it('simulation validates data without any query or write', async () => {
    await new RecordImporter(client).import(
      'deals',
      { id: '1', name: 'Sale', amount_total: 1 },
      'acme',
      'run',
      true,
    );
    expect(query).not.toHaveBeenCalled();
    expect(mutation).not.toHaveBeenCalled();
  });
  it('simulation rejects an invalid amount before writing', async () => {
    await expect(
      new RecordImporter(client).import(
        'deals',
        { id: '1', amount_total: NaN },
        'acme',
        'run',
        true,
      ),
    ).rejects.toThrow('amount');
    expect(mutation).not.toHaveBeenCalled();
  });
  it('skips completed records without updating native data', async () => {
    query.mockResolvedValue({
      rdSourceRecords: { edges: [{ node: { id: 'a', targetId: 'native' } }] },
    });
    expect(
      await new RecordImporter(client).import(
        'deals',
        { id: '1' },
        'acme',
        'run',
        false,
      ),
    ).toBe('skipped');
    expect(mutation).not.toHaveBeenCalled();
  });
  it('resumes after an archive write but before a native record write', async () => {
    query
      .mockResolvedValueOnce({
        rdSourceRecords: {
          edges: [{ node: { id: 'archive', targetId: null } }],
        },
      })
      .mockResolvedValueOnce({ companies: { edges: [] } });
    expect(
      await new RecordImporter(client).import(
        'organizations',
        { id: '1', name: 'Acme' },
        'acme',
        'run',
        false,
      ),
    ).toBe('created');
    expect(mutation.mock.calls[0][0]).toMatchObject({
      createCompany: {
        __args: {
          data: { id: sourceId('acme:organizations:1'), name: 'Acme' },
        },
      },
    });
    expect(mutation.mock.calls[1][0]).toHaveProperty('updateRdSourceRecord');
  });
  it('preserves local edits when retrying a native creation', async () => {
    query
      .mockResolvedValueOnce({
        rdSourceRecords: {
          edges: [{ node: { id: 'archive', targetId: null } }],
        },
      })
      .mockResolvedValueOnce({
        companies: { edges: [{ node: { id: 'native' } }] },
      });
    expect(
      await new RecordImporter(client).import(
        'organizations',
        { id: '1', name: 'Old RD Name' },
        'acme',
        'run',
        false,
      ),
    ).toBe('skipped');
    expect(mutation).toHaveBeenCalledTimes(1);
    expect(mutation.mock.calls[0][0]).toHaveProperty('updateRdSourceRecord');
  });
  it('does not finalize a source record when a relation is missing', async () => {
    query.mockResolvedValue({ rdSourceRecords: { edges: [] } });
    await expect(
      new RecordImporter(client).import(
        'contacts',
        { id: '1', organization_id: 'missing' },
        'acme',
        'run',
        false,
      ),
    ).rejects.toThrow('Missing imported organizations');
    expect(
      mutation.mock.calls.some(
        ([request]) => 'updateRdSourceRecord' in request,
      ),
    ).toBe(false);
  });
  it('namespaces child products by deal rather than overwriting another deal', async () => {
    query.mockResolvedValue({ rdSourceRecords: { edges: [] } });
    const importer = new RecordImporter(client);
    await importer.import(
      'deal-products',
      { id: 'product1' },
      'acme',
      'run',
      false,
      'deal1',
    );
    await importer.import(
      'deal-products',
      { id: 'product1' },
      'acme',
      'run',
      false,
      'deal2',
    );
    const ids = mutation.mock.calls
      .filter(([q]) => q.createRdSourceRecord)
      .map(([q]) => q.createRdSourceRecord.__args.data.id);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('native pipeline imports', () => {
  it('upgrades an archived pipeline without overwriting a locally edited catalog', async () => {
    query
      .mockResolvedValueOnce({
        rdSourceRecords: {
          edges: [{ node: { id: 'archive', targetId: 'archive' } }],
        },
      })
      .mockResolvedValueOnce({
        salesPipelines: { edges: [{ node: { id: 'native' } }] },
      });
    expect(
      await new RecordImporter(client).import(
        'pipelines',
        { id: 'p', name: 'Old source name' },
        'acme',
        'run',
        false,
      ),
    ).toBe('skipped');
    expect(mutation).toHaveBeenCalledTimes(1);
    expect(
      mutation.mock.calls[0][0].updateRdSourceRecord.__args.data.targetId,
    ).toBe(sourceId('acme:pipelines:p'));
  });
  it('creates a native stage linked to its pipeline and preserves order', async () => {
    query
      .mockResolvedValueOnce({ rdSourceRecords: { edges: [] } })
      .mockResolvedValueOnce({ salesStages: { edges: [] } })
      .mockResolvedValueOnce({
        rdSourceRecords: { edges: [{ node: { targetId: 'pipeline-native' } }] },
      });
    await new RecordImporter(client).import(
      'stages',
      { id: 's', name: 'Contact', order: 3 },
      'acme',
      'run',
      false,
      'p',
    );
    expect(
      mutation.mock.calls.find(([q]) => q.createSalesStage)?.[0],
    ).toMatchObject({
      createSalesStage: {
        __args: {
          data: { salesPipelineId: 'pipeline-native', sourceOrder: 3 },
        },
      },
    });
  });
  it('stops a missing pipeline rather than losing the stage relationship', async () => {
    query
      .mockResolvedValueOnce({ rdSourceRecords: { edges: [] } })
      .mockResolvedValueOnce({ salesStages: { edges: [] } })
      .mockResolvedValueOnce({ rdSourceRecords: { edges: [] } });
    await expect(
      new RecordImporter(client).import(
        'stages',
        { id: 's' },
        'acme',
        'run',
        false,
        'missing',
      ),
    ).rejects.toThrow('Missing imported pipelines');
    expect(
      mutation.mock.calls.some(
        ([q]) => q.createSalesStage || q.updateRdSourceRecord,
      ),
    ).toBe(false);
  });
});

describe('repeated imports against persisted destination state', () => {
  type Row = { id: string; [key: string]: unknown };
  type Request = Record<
    string,
    {
      __args: {
        id?: string;
        data?: Row;
        filter?: {
          id?: { eq: string };
          emails?: { primaryEmail: { eq: string } };
        };
      };
    }
  >;
  const memoryApi = () => {
    const tables = new Map<string, Map<string, Row>>();
    const table = (name: string) => {
      let rows = tables.get(name);
      if (!rows) {
        rows = new Map();
        tables.set(name, rows);
      }
      return rows;
    };
    const creates: Record<string, string> = {
      createRdSourceRecord: 'rdSourceRecords',
      createCompany: 'companies',
      createPerson: 'people',
      createOpportunity: 'opportunities',
      createTask: 'tasks',
      createNote: 'notes',
      createTaskTarget: 'taskTargets',
      createNoteTarget: 'noteTargets',
    };
    const read = vi.fn(async (request: Request) => {
      const [name, selection] = Object.entries(request)[0];
      const filter = selection.__args.filter;
      const rows = [...table(name).values()].filter((row) => {
        if (filter?.id) return row.id === filter.id.eq;
        if (filter?.emails) {
          const emails = row.emails as { primaryEmail?: string } | undefined;
          return emails?.primaryEmail === filter.emails.primaryEmail.eq;
        }
        throw new Error('Unexpected test query.');
      });
      return {
        [name]: {
          edges: rows.map((node) => ({ node: structuredClone(node) })),
        },
      };
    });
    const write = vi.fn(async (request: Request) => {
      const [name, selection] = Object.entries(request)[0];
      const { data, id } = selection.__args;
      if (name === 'updateRdSourceRecord') {
        const row = table('rdSourceRecords').get(id!);
        if (!row) throw new Error('Missing test archive.');
        Object.assign(row, structuredClone(data));
        return { [name]: { id } };
      }
      const destination = creates[name];
      if (!destination || !data) throw new Error('Unexpected test mutation.');
      const rows = table(destination);
      // Model the database primary-key guard as well as the pre-create lookup.
      if (rows.has(data.id)) throw new Error('Duplicate primary key.');
      rows.set(data.id, structuredClone(data));
      return { [name]: { id: data.id } };
    });
    return {
      table,
      read,
      write,
      client: { query: read, mutation: write } as unknown as CoreApiClient,
    };
  };

  it.each([
    ['organizations', 'companies'],
    ['contacts', 'people'],
    ['deals', 'opportunities'],
    ['tasks', 'tasks'],
    ['activities', 'notes'],
  ])(
    'skips the same %s ID across run IDs and preserves local edits',
    async (kind, destination) => {
      const api = memoryApi();
      const record = {
        id: 'source-1',
        name: 'RD name',
        subject: 'RD task',
        text: 'RD note',
      };
      expect(
        await new RecordImporter(api.client).import(
          kind,
          record,
          'acme',
          'first-run',
          false,
        ),
      ).toBe('created');
      const row = [...api.table(destination).values()][0];
      Object.assign(row, {
        name: 'Edited in Twenty',
        dealStatus: 'PAUSED',
        title: 'Local title',
      });
      const before = structuredClone(row);
      api.write.mockClear();

      for (const runId of ['second-run', 'third-run']) {
        expect(
          await new RecordImporter(api.client).import(
            kind,
            { ...record, name: 'New RD name' },
            'acme',
            runId,
            false,
          ),
        ).toBe('skipped');
      }
      expect(api.table(destination).size).toBe(1);
      expect(api.table('rdSourceRecords').size).toBe(1);
      expect([...api.table(destination).values()]).toEqual([before]);
      expect(api.write).not.toHaveBeenCalled();
    },
  );

  it('recovers a native creation whose archive completion failed without duplicating or overwriting it', async () => {
    const api = memoryApi();
    const write = api.write.getMockImplementation()!;
    let failCompletion = true;
    api.write.mockImplementation(async (request) => {
      if (request.updateRdSourceRecord && failCompletion) {
        failCompletion = false;
        throw new Error('Interrupted before archive completion.');
      }
      return write(request);
    });
    const record = { id: 'source-1', name: 'RD name' };
    await expect(
      new RecordImporter(api.client).import(
        'organizations',
        record,
        'acme',
        'first-run',
        false,
      ),
    ).rejects.toThrow('Interrupted');
    const row = [...api.table('companies').values()][0];
    row.name = 'Edited after interruption';

    expect(
      await new RecordImporter(api.client).import(
        'organizations',
        record,
        'acme',
        'retry-run',
        false,
      ),
    ).toBe('skipped');
    expect(api.table('companies').size).toBe(1);
    expect(row.name).toBe('Edited after interruption');
    expect([...api.table('rdSourceRecords').values()][0].targetId).toBe(row.id);
  });

  it('allows only one destination record when two imports race, then safely skips the retry', async () => {
    const api = memoryApi();
    const record = { id: 'source-1', name: 'RD name' };
    const attempts = await Promise.allSettled(
      ['first-run', 'second-run'].map((runId) =>
        new RecordImporter(api.client).import(
          'organizations',
          record,
          'acme',
          runId,
          false,
        ),
      ),
    );
    expect(
      attempts.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      attempts.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(api.table('companies').size).toBe(1);
    expect(api.table('rdSourceRecords').size).toBe(1);
    expect(
      await new RecordImporter(api.client).import(
        'organizations',
        record,
        'acme',
        'retry-run',
        false,
      ),
    ).toBe('skipped');
  });

  it('keeps distinct RD IDs and source companies separate even when names match', async () => {
    const api = memoryApi();
    for (const [account, id] of [
      ['acme', 'one'],
      ['acme', 'two'],
      ['other-company', 'one'],
    ]) {
      await new RecordImporter(api.client).import(
        'organizations',
        { id, name: 'Same name' },
        account,
        'run',
        false,
      );
    }
    expect(api.table('companies').size).toBe(3);
    expect(api.table('rdSourceRecords').size).toBe(3);
  });

  it('stops on a primary-email conflict before creating or merging a second contact', async () => {
    const api = memoryApi();
    const record = {
      id: 'one',
      name: 'First contact',
      emails: ['same@example.invalid'],
    };
    await new RecordImporter(api.client).import(
      'contacts',
      record,
      'acme',
      'first-run',
      false,
    );
    api.write.mockClear();
    await expect(
      new RecordImporter(api.client).import(
        'contacts',
        { ...record, id: 'two', name: 'Different contact' },
        'acme',
        'second-run',
        false,
      ),
    ).rejects.toThrow('RD_CONTACT_EMAIL_CONFLICT');
    expect(api.table('people').size).toBe(1);
    expect(api.table('rdSourceRecords').size).toBe(1);
    expect(api.write).not.toHaveBeenCalled();
  });
});

describe('owner association on record replay', () => {
  it.each([
    ['deals', 'updateOpportunities', 'ownerId'],
    ['organizations', 'updateCompanies', 'accountOwnerId'],
    ['tasks', 'updateTasks', 'assigneeId'],
  ])(
    'fills only an empty %s owner after the member is registered',
    async (kind, operation, field) => {
      const key = `acme:${kind}:existing`;
      query.mockImplementation(async (request) => {
        if (request.opportunities)
          return {
            opportunities: {
              edges: [
                { node: { id: sourceId(key), rdSourceRecordId: 'existing' } },
              ],
            },
          };
        if (request.workspaceMembers)
          return {
            workspaceMembers: {
              edges: [
                { node: { id: 'member', userEmail: 'owner@example.com' } },
              ],
              pageInfo: { hasNextPage: false },
            },
          };
        if (request.rdSourceRecords.__args.filter.recordKind)
          return {
            rdSourceRecords: { edges: [], pageInfo: { hasNextPage: false } },
          };
        if (request.rdSourceRecords.__args.filter.sourceKey)
          return {
            rdSourceRecords: {
              edges: [
                {
                  node: {
                    sourcePayload: { id: 'user', email: 'owner@example.com' },
                  },
                },
              ],
            },
          };
        return {
          rdSourceRecords: { edges: [{ node: { targetId: sourceId(key) } }] },
        };
      });
      expect(
        await new RecordImporter(client).import(
          kind,
          { id: 'existing', owner_id: 'user' },
          'acme',
          'run',
          false,
        ),
      ).toBe('skipped');
      expect(mutation).toHaveBeenCalledTimes(1);
      expect(mutation.mock.calls[0][0][operation].__args).toEqual({
        filter: {
          id: { eq: sourceId(key) },
          rdSourceKey: { eq: key },
          [field]: { is: 'NULL' },
        },
        data: { [field]: 'member' },
      });
    },
  );
});
