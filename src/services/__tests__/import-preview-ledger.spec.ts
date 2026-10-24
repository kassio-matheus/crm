import { expect, it, vi } from 'vitest';
import type { CoreApiClient } from 'twenty-client-sdk/core';
import { ImportPreviewLedger } from '../import-preview-ledger';
import { sourceId } from 'src/utils/source-id.util';
import type { PreviewOwnedRecord } from 'src/types/preview-owned-record';
const setup = (owned: PreviewOwnedRecord[] = []) => {
  const rows = owned.map((item) => ({
    cursor: item.id,
    node: {
      id: sourceId(`preview:run:${item.table}:${item.id}`),
      sourcePayload: { ...item },
    },
  }));
  const active = new Set(owned.map((item) => item.id));
  let blocked = false;
  const query = vi.fn(
    async (
      request: Record<
        string,
        { __args?: { filter?: { id?: { eq: string } } } }
      >,
    ) => {
      const table = Object.keys(request)[0];
      if (table === 'rdSourceRecords')
        return {
          rdSourceRecords: {
            edges: request.rdSourceRecords.__args?.filter?.id ? [] : rows,
          },
        };
      const id = request[table].__args?.filter?.id?.eq;
      const item = owned.find((entry) => entry.id === id);
      return {
        [table]: {
          edges: id
            ? active.has(id)
              ? [{ node: { id, rdSourceKey: item?.key, sourceKey: item?.key } }]
              : []
            : blocked
              ? [{ node: { id: 'outside-sample' } }]
              : [],
        },
      };
    },
  );
  const mutation = vi.fn(
    async (
      request: Record<
        string,
        { __args: { id?: string; data?: Record<string, unknown> } }
      >,
    ) => {
      const name = Object.keys(request)[0];
      const { id, data } = request[name].__args;
      if (name === 'updateRdSourceRecord')
        rows.find((row) => row.node.id === id)!.node.sourcePayload =
          structuredClone(data!.sourcePayload) as PreviewOwnedRecord;
      if (name.startsWith('delete')) active.delete(id!);
      if (name.startsWith('restore')) active.add(id!);
      return {};
    },
  );
  const core = { query, mutation } as unknown as CoreApiClient;
  return {
    ledger: new ImportPreviewLedger('run', 'acme', core),
    query,
    mutation,
    active,
    rows,
    block: () => {
      blocked = true;
    },
  };
};
const company = (): PreviewOwnedRecord => ({
  table: 'companies',
  id: sourceId('acme:organizations:one'),
  key: 'acme:organizations:one',
  deleted: false,
});
it('persists an ownership receipt before a native creation and refuses unknown targets', async () => {
  const test = setup();
  await test.ledger.client().mutation({
    createCompany: {
      __args: {
        data: {
          id: company().id,
          rdSourceKey: company().key,
          name: 'Sample',
        },
      },
      id: true,
    },
  });
  expect(Object.keys(test.mutation.mock.calls[0][0])).toEqual([
    'createRdSourceRecord',
  ]);
  expect(Object.keys(test.mutation.mock.calls[1][0])).toEqual([
    'createCompany',
  ]);
  await expect(
    test.ledger.client().mutation({
      createCompany: {
        __args: {
          data: { id: 'unrelated', rdSourceKey: 'acme:organizations:one' },
        },
        id: true,
      },
    }),
  ).rejects.toThrow('RD_INVALID_PREVIEW_TARGET');
});
it('moves only owned records to trash, retains receipts and can restore them before full import', async () => {
  const owned = company();
  const test = setup([owned]);
  await test.ledger.cleanup(vi.fn());
  expect(test.active.size).toBe(0);
  expect(test.rows[0].node.sourcePayload.deleted).toBe(true);
  const operations = test.mutation.mock.calls.map(
    ([request]) => Object.keys(request)[0],
  );
  expect(operations).toEqual(['updateRdSourceRecord', 'deleteCompany']);
  expect(operations.some((name) => name.startsWith('destroy'))).toBe(false);
  await test.ledger.restore();
  expect(test.active.has(owned.id)).toBe(true);
  expect(test.rows[0].node.sourcePayload.deleted).toBe(false);
});
it('checks external dependencies before the first deletion', async () => {
  const test = setup([company()]);
  test.block();
  await expect(test.ledger.cleanup(vi.fn())).rejects.toThrow(
    'RD_PREVIEW_IN_USE',
  );
  expect(test.mutation).not.toHaveBeenCalled();
});
it('rejects forged ownership receipts instead of addressing arbitrary records', async () => {
  const test = setup([company()]);
  test.rows[0].node.id = 'forged';
  await expect(test.ledger.cleanup(vi.fn())).rejects.toThrow(
    'RD_INVALID_PREVIEW_RECEIPT',
  );
  expect(test.mutation).not.toHaveBeenCalled();
});
it('resumes cleanup after a previous soft delete without issuing another deletion', async () => {
  const test = setup([{ ...company(), deleted: true }]);
  test.active.clear();
  await test.ledger.cleanup(vi.fn());
  expect(
    test.mutation.mock.calls.some(([request]) => 'deleteCompany' in request),
  ).toBe(false);
});
