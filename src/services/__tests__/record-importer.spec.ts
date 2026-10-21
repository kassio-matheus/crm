import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { RecordImporter } from '../record-importer';
import { sourceId } from 'src/utils/source-id.util';
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
