import { expect, it, vi } from 'vitest';
import type { CoreApiClient } from 'twenty-client-sdk/core';
import { ImportOwners } from '../import-owners';
import { sourceId } from 'src/utils/source-id.util';

const memberPage = (
  rows: { id: string; userEmail: string }[],
  next = false,
  cursor = 'next',
) => ({
  workspaceMembers: {
    edges: rows.map((node) => ({ node })),
    pageInfo: { hasNextPage: next, endCursor: cursor },
  },
});
const setup = () => {
  const query = vi.fn().mockResolvedValue(memberPage([]));
  const mutation = vi.fn().mockResolvedValue({});
  return {
    query,
    mutation,
    client: { query, mutation } as unknown as CoreApiClient,
  };
};
it('matches a unique normalized email, paginates all members and caches the batch index', async () => {
  const api = setup();
  api.query
    .mockResolvedValueOnce(
      memberPage([{ id: 'other', userEmail: 'other@example.com' }], true),
    )
    .mockResolvedValueOnce(
      memberPage([{ id: 'member', userEmail: ' Owner@Example.com ' }]),
    );
  const owners = new ImportOwners(api.client);
  expect(
    await owners.match({ id: 'rd-user', email: ' OWNER@example.COM ' }),
  ).toMatchObject({
    memberId: 'member',
    email: 'owner@example.com',
    status: 'matched',
  });
  await owners.match({ id: 'rd-user', email: 'owner@example.com' });
  expect(api.query).toHaveBeenCalledTimes(2);
  expect(api.query.mock.calls[1][0].workspaceMembers.__args.after).toBe('next');
  expect(api.mutation).not.toHaveBeenCalled();
});
it('never guesses by name or assigns an ambiguous email', async () => {
  const api = setup();
  api.query.mockResolvedValue(
    memberPage([
      { id: 'one', userEmail: 'owner@example.com' },
      { id: 'two', userEmail: 'OWNER@example.com' },
    ]),
  );
  const owners = new ImportOwners(api.client);
  expect(await owners.match({ name: 'Same name' })).toMatchObject({
    status: 'missing',
    memberId: null,
  });
  expect(await owners.match({ email: 'owner@example.com' })).toMatchObject({
    status: 'ambiguous',
    memberId: null,
  });
  expect(await owners.match({ email: 'missing@example.com' })).toMatchObject({
    status: 'missing',
    memberId: null,
  });
});
it('fails closed if workspace-member pagination does not advance', async () => {
  const api = setup();
  api.query.mockResolvedValue(memberPage([], true, 'repeated'));
  await expect(
    new ImportOwners(api.client).match({ email: 'x@example.com' }),
  ).rejects.toThrow('RD_OWNER_MEMBER_PAGE_CHANGED');
});
it.each([
  ['deals', { owner_id: 'user' }],
  ['deals', { user: { _id: 'user' } }],
  ['organizations', { owner_id: 'user' }],
  ['tasks', { owner_ids: ['user'] }],
  ['tasks', { user_ids: ['user'] }],
  ['tasks', { user_id: 'user' }],
])(
  'resolves %s source owner to an existing workspace member',
  async (kind, record) => {
    const api = setup();
    api.query
      .mockResolvedValueOnce({
        rdSourceRecords: {
          edges: [
            {
              node: {
                sourcePayload: { id: 'user', email: 'owner@example.com' },
              },
            },
          ],
        },
      })
      .mockResolvedValueOnce(
        memberPage([{ id: 'member', userEmail: 'owner@example.com' }]),
      );
    expect(
      await new ImportOwners(api.client).forRecord(kind, record, 'account'),
    ).toMatchObject({ memberId: 'member' });
    expect(
      api.query.mock.calls[0][0].rdSourceRecords.__args.filter.sourceKey.eq,
    ).toBe('account:users:user');
  },
);
it('uses the current catalog email instead of a stale historical snapshot', async () => {
  const api = setup();
  api.query.mockResolvedValue(
    memberPage([{ id: 'member', userEmail: 'new@example.com' }]),
  );
  const owners = new ImportOwners(api.client, {
    user: {
      sourceId: 'user',
      email: 'new@example.com',
      name: '',
      memberId: null,
      status: 'missing',
    },
  });
  expect(
    await owners.forRecord('deals', { owner_id: 'user' }, 'account'),
  ).toMatchObject({ memberId: 'member' });
  expect(api.query.mock.calls.every(([r]) => r.workspaceMembers)).toBe(true);
});
it.each([{ owner_ids: ['one', 'two'] }, { owner_ids: [] }, {}])(
  'leaves multi-owner or unowned tasks unassigned',
  async (record) => {
    const api = setup();
    expect(
      await new ImportOwners(api.client).forRecord('tasks', record, 'account'),
    ).toBeNull();
    expect(api.query).not.toHaveBeenCalled();
  },
);
it('leaves missing source users unassigned and ignores contact ownership', async () => {
  const api = setup();
  api.query.mockResolvedValue({ rdSourceRecords: { edges: [] } });
  const owners = new ImportOwners(api.client);
  expect(
    await owners.forRecord('deals', { owner_id: 'missing' }, 'account'),
  ).toBeNull();
  expect(
    await owners.forRecord('contacts', { owner_id: 'missing' }, 'account'),
  ).toBeNull();
});
it.each([
  ['deals', 'updateOpportunities', 'ownerId'],
  ['organizations', 'updateCompanies', 'accountOwnerId'],
  ['tasks', 'updateTasks', 'assigneeId'],
])(
  'fills only null owners on the exact canonical %s source identity',
  async (kind, mutation, field) => {
    const api = setup();
    const key = `account:${kind}:record`;
    await new ImportOwners(api.client).fillMissing(kind, key, 'member');
    expect(api.mutation).toHaveBeenCalledWith({
      [mutation]: {
        __args: {
          filter: {
            id: { eq: sourceId(key) },
            rdSourceKey: { eq: key },
            [field]: { is: 'NULL' },
          },
          data: { [field]: 'member' },
        },
        id: true,
      },
    });
  },
);
