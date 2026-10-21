import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreApiClient } from 'twenty-client-sdk/core';
import { SalesRepository } from '../sales-repository';
const query = vi.fn();
const mutation = vi.fn();
const repository = () =>
  new SalesRepository({ query, mutation } as unknown as CoreApiClient);
const connection = (
  nodes: unknown[],
  hasNextPage = false,
  endCursor: string | null = null,
) => ({
  edges: nodes.map((node) => ({ node })),
  pageInfo: { hasNextPage, endCursor },
});
beforeEach(() => {
  vi.clearAllMocks();
  mutation.mockResolvedValue({});
});
describe('SalesRepository', () => {
  it('loads every opportunity page rather than silently truncating at 100', async () => {
    query
      .mockResolvedValueOnce({
        opportunities: connection([{ id: 'a', name: 'A' }], true, 'next'),
      })
      .mockResolvedValueOnce({
        opportunities: connection([{ id: 'b', name: 'B' }]),
      })
      .mockResolvedValueOnce({ rdSourceRecords: connection([]) })
      .mockResolvedValueOnce({ workspaceMembers: connection([]) })
      .mockResolvedValueOnce({ tasks: connection([]) });
    expect((await repository().load()).deals.map((d) => d.id)).toEqual([
      'a',
      'b',
    ]);
    expect(query.mock.calls[1][0].opportunities.__args.after).toBe('next');
  });
  it('refuses a stalled opportunity cursor', async () => {
    query.mockResolvedValue({ opportunities: connection([], true, 'same') });
    await expect(repository().load()).rejects.toThrow('paginação');
  });
  it('validates task input before writes', async () => {
    await expect(
      repository().createTask('id', '', 'bad', 'request'),
    ).rejects.toThrow();
    expect(mutation).not.toHaveBeenCalled();
  });
  it('retries a task link without duplicating a successfully saved task', async () => {
    query
      .mockResolvedValueOnce({ tasks: { edges: [{ node: { id: 'saved' } }] } })
      .mockResolvedValueOnce({ taskTargets: { edges: [] } });
    await repository().createTask('deal', 'Call', '2026-11-01', 'saved');
    expect(mutation).toHaveBeenCalledTimes(1);
    expect(mutation.mock.calls[0][0]).toHaveProperty('createTaskTarget');
  });
  it('retries a note link without creating a second note', async () => {
    query
      .mockResolvedValueOnce({ notes: { edges: [{ node: { id: 'saved' } }] } })
      .mockResolvedValueOnce({ noteTargets: { edges: [] } });
    await repository().addNote('deal', 'A note', 'saved');
    expect(mutation).toHaveBeenCalledTimes(1);
    expect(mutation.mock.calls[0][0]).toHaveProperty('createNoteTarget');
  });
  it('preserves status when changing an owner or stage', async () => {
    await repository().update('deal', {
      ownerId: 'member',
      salesStageKey: 'next',
    });
    expect(mutation.mock.calls[0][0].updateOpportunity.__args.data).toEqual({
      ownerId: 'member',
      salesStageKey: 'next',
    });
  });
});
