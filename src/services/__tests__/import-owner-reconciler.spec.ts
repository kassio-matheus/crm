import { beforeEach, expect, it, vi } from 'vitest';
import type { CoreApiClient } from 'twenty-client-sdk/core';
import type { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { ImportOwnerReconciler } from '../import-owner-reconciler';
import { ImportOwners } from '../import-owners';
import { sourceId } from 'src/utils/source-id.util';
const rd = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('src/rd-client/rd-client', () => ({
  RdClient: class {
    list = rd.list;
  },
}));
beforeEach(() => {
  vi.restoreAllMocks();
  rd.list.mockReset();
  process.env.RD_CREDENTIALS = JSON.stringify({
    accountKey: 'acme',
    version: 'v2',
    accessToken: 'SECRET',
    refreshToken: 'SECRET',
    clientId: 'client',
    clientSecret: 'SECRET',
  });
});
const setup = (kind: 'deals' | 'organizations' | 'tasks' = 'deals') => {
  const table =
    kind === 'deals'
      ? 'opportunities'
      : kind === 'organizations'
        ? 'companies'
        : 'tasks';
  const field =
    kind === 'deals'
      ? 'ownerId'
      : kind === 'organizations'
        ? 'accountOwnerId'
        : 'assigneeId';
  const key = `acme:${kind}:rd`,
    id = sourceId(key);
  const row: Record<string, unknown> = { id, rdSourceKey: key, [field]: null };
  const query = vi
    .fn()
    .mockImplementation(async () => ({
      [table]: { edges: [{ node: { ...row } }] },
    }));
  const mutation = vi.fn().mockImplementation(async (request) => {
    const operation = Object.values(request)[0] as any;
    if (row[field] === null) row[field] = operation.__args.data[field];
    return {};
  });
  const metadata = { query: vi.fn().mockResolvedValue({}), mutation: vi.fn() };
  const sleep = vi.fn().mockResolvedValue(undefined);
  const match = vi
    .spyOn(ImportOwners.prototype, 'forRecord')
    .mockResolvedValue({
      sourceId: 'fresh-user',
      name: 'Owner',
      email: 'source@example.com',
      memberId: 'member',
      status: 'matched',
      matchMethod: 'explicit',
    });
  rd.list.mockResolvedValue({
    records: [{ id: 'rd', owner_id: 'fresh-user' }],
  });
  return {
    row,
    query,
    mutation,
    metadata,
    sleep,
    match,
    payload: { records: [{ id, kind }] },
    service: new ImportOwnerReconciler(
      { query, mutation } as unknown as CoreApiClient,
      metadata as unknown as MetadataApiClient,
      sleep,
    ),
    field,
    key,
  };
};
it.each(['deals', 'organizations', 'tasks'] as const)(
  'uses the current RD owner and conditionally fills a native %s owner',
  async (kind) => {
    const t = setup(kind);
    const result = await t.service.run(t.payload);
    expect(result).toMatchObject({
      completed: true,
      assigned: 1,
      requests: 1,
      preserved: 0,
    });
    expect(rd.list).toHaveBeenCalledWith(`${kind}/rd`, 1, null, true);
    expect(t.match).toHaveBeenCalledWith(
      kind,
      { id: 'rd', owner_id: 'fresh-user' },
      'acme',
    );
    const input = (Object.values(t.mutation.mock.calls[0][0])[0] as any).__args;
    expect(input.filter).toMatchObject({
      id: { eq: t.payload.records[0].id },
      rdSourceKey: { eq: t.key },
      [t.field]: { is: 'NULL' },
    });
    expect(input.data).toEqual({ [t.field]: 'member' });
  },
);
it('preserves a pre-existing owner without an RD request', async () => {
  const t = setup();
  t.row.ownerId = 'manual';
  expect(await t.service.run(t.payload)).toMatchObject({
    completed: true,
    preserved: 1,
    requests: 0,
  });
  expect(rd.list).not.toHaveBeenCalled();
  expect(t.mutation).not.toHaveBeenCalled();
});
it('preserves a manual assignment that wins the conditional write race', async () => {
  const t = setup();
  t.mutation.mockImplementation(async () => {
    t.row.ownerId = 'manual';
    return {};
  });
  expect(await t.service.run(t.payload)).toMatchObject({
    completed: true,
    preserved: 1,
    assigned: 0,
  });
  expect(t.row.ownerId).toBe('manual');
});
it('leaves unresolved owners empty and never guesses', async () => {
  const t = setup();
  t.match.mockResolvedValue(null);
  expect(await t.service.run(t.payload)).toMatchObject({
    completed: true,
    unresolved: 1,
    assigned: 0,
  });
  expect(t.mutation).not.toHaveBeenCalled();
});
it('rejects cross-company or noncanonical identities before reading RD', async () => {
  const t = setup();
  t.row.rdSourceKey = 'other:deals:rd';
  expect(await t.service.run(t.payload)).toMatchObject({
    completed: false,
    error: 'RD_OWNER_RECONCILE_IDENTITY',
  });
  expect(rd.list).not.toHaveBeenCalled();
  expect(t.mutation).not.toHaveBeenCalled();
});
it('checks administrator authorization before source access or native reads', async () => {
  const t = setup();
  t.metadata.query.mockRejectedValue(new Error('Forbidden'));
  await expect(t.service.run(t.payload)).rejects.toThrow('Forbidden');
  expect(t.query).not.toHaveBeenCalled();
  expect(rd.list).not.toHaveBeenCalled();
});
it('honors RD backoff and bounds retries without native writes', async () => {
  const t = setup();
  rd.list.mockRejectedValue(new Error('RD_RETRY:125000'));
  expect(await t.service.run(t.payload)).toMatchObject({
    completed: false,
    requests: 4,
    error: 'RD_RETRY',
  });
  expect(t.sleep).toHaveBeenCalledTimes(3);
  expect(t.sleep.mock.calls.every(([ms]) => ms >= 124000)).toBe(true);
  expect(t.mutation).not.toHaveBeenCalled();
});
it('retries once after token refresh and rejects a mismatched source record', async () => {
  const t = setup();
  rd.list
    .mockRejectedValueOnce(new Error('RD_TOKEN_REFRESHED'))
    .mockResolvedValueOnce({ records: [{ id: 'another' }] });
  expect(await t.service.run(t.payload)).toMatchObject({
    completed: false,
    requests: 2,
    error: 'RD_OWNER_RECONCILE_SOURCE_ID',
  });
  expect(t.mutation).not.toHaveBeenCalled();
});
it('redacts unknown source errors', async () => {
  const t = setup();
  rd.list.mockRejectedValue(new Error('https://example.com?token=SECRET'));
  const result = await t.service.run(t.payload);
  expect(result.error).toBe('RD_OWNER_RECONCILE_FAILED');
  expect(JSON.stringify(result)).not.toContain('SECRET');
});
