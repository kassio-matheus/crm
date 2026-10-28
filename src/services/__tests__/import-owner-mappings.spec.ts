import { expect, it, vi } from 'vitest';
import type { CoreApiClient } from 'twenty-client-sdk/core';
import { ImportOwnerMappings } from '../import-owner-mappings';
import { sourceId } from 'src/utils/source-id.util';

const record = (account = 'a', id = 'rd') => ({
  id: sourceId(`${account}:owner-mapping:${id}`),
  sourceKey: `${account}:owner-mapping:${id}`,
  sourceId: id,
  targetId: 'member',
});
const page = (
  rows: ReturnType<typeof record>[],
  hasNextPage = false,
  endCursor = 'next',
) => ({
  rdSourceRecords: {
    edges: rows.map((node) => ({ node })),
    pageInfo: { hasNextPage, endCursor },
  },
});
const setup = () => {
  const query = vi.fn();
  return {
    query,
    mappings: new ImportOwnerMappings({ query } as unknown as CoreApiClient),
  };
};

it('loads only confirmed mappings from the requested account and caches one catalog per batch', async () => {
  const t = setup();
  t.query.mockResolvedValue(page([record()]));
  expect((await t.mappings.read('a')).get('rd')).toBe('member');
  await t.mappings.read('a');
  expect(t.query).toHaveBeenCalledTimes(1);
  expect(t.query.mock.calls[0][0].rdSourceRecords.__args.filter).toEqual({
    sourceKey: { startsWith: 'a:owner-mapping:' },
    recordKind: { eq: 'ownerMapping' },
  });
  t.query.mockResolvedValue(page([]));
  expect((await t.mappings.read('b')).size).toBe(0);
  expect(t.query).toHaveBeenCalledTimes(2);
});

it('paginates all mappings and rejects nonadvancing cursors', async () => {
  const t = setup();
  t.query
    .mockResolvedValueOnce(page([record('a', 'one')], true))
    .mockResolvedValueOnce(page([record('a', 'two')]));
  expect((await t.mappings.read('a')).size).toBe(2);
  expect(t.query.mock.calls[1][0].rdSourceRecords.__args.after).toBe('next');
  const broken = setup();
  broken.query.mockResolvedValue(page([], true, 'same'));
  await expect(broken.mappings.read('a')).rejects.toThrow(
    'RD_OWNER_MAPPING_PAGE_CHANGED',
  );
});

it.each([
  { ...record(), id: 'unrelated' },
  record('other'),
  { ...record(), targetId: '' },
  { ...record(), sourceKey: 'a:users:rd' },
])('rejects a corrupted or cross-account mapping', async (row) => {
  const t = setup();
  t.query.mockResolvedValue(page([row]));
  await expect(t.mappings.read('a')).rejects.toThrow(
    'RD_OWNER_MAPPING_INVALID',
  );
});

it('rejects duplicate source identities rather than choosing a member', async () => {
  const t = setup();
  t.query.mockResolvedValue(page([record(), record()]));
  await expect(t.mappings.read('a')).rejects.toThrow(
    'RD_OWNER_MAPPING_DUPLICATE',
  );
});
