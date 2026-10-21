import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), run: vi.fn() }));
vi.mock('twenty-client-sdk/core', () => ({
  CoreApiClient: class {
    query = mocks.query;
  },
}));
vi.mock('twenty-sdk/logic-function', () => ({ runAgent: mocks.run }));
import definition from '../sales-priorities';
const context = {
  retryCount: 0,
  maxRetries: 0,
  workspaceId: 'w',
  userWorkspaceId: null,
  workspaceMemberId: null,
};
beforeEach(() => vi.clearAllMocks());
describe('sales-priorities', () => {
  it('rejects empty/oversized or malformed bulk selections', async () => {
    for (const records of [
      [],
      [{ id: 'bad' }],
      Array.from({ length: 201 }, () => ({ id: 'a'.repeat(36) })),
    ])
      await expect(
        definition.config.handler({ records }, context),
      ).rejects.toThrow();
    expect(mocks.run).not.toHaveBeenCalled();
  });
  it('returns a summary from the native read-only AI agent', async () => {
    mocks.query
      .mockResolvedValueOnce({
        opportunities: {
          edges: [{ node: { id: 'deal', name: 'Sale', qualification: 5 } }],
        },
      })
      .mockResolvedValueOnce({
        taskTargets: { edges: [], pageInfo: { hasNextPage: false } },
      });
    mocks.run.mockResolvedValue({
      success: true,
      status: 'COMPLETED',
      result: { summary: 'Ligue para o cliente.' },
    });
    expect(
      await definition.config.handler(
        { records: [{ id: '20202020-9549-49dd-b2b2-883999db8938' }] },
        context,
      ),
    ).toEqual({ summary: 'Ligue para o cliente.' });
    expect(mocks.run.mock.calls[0][0].input).toContain('untrusted CRM facts');
  });
  it('makes unavailable AI explicit', async () => {
    mocks.query
      .mockResolvedValueOnce({ opportunities: { edges: [] } })
      .mockResolvedValueOnce({
        taskTargets: { edges: [], pageInfo: { hasNextPage: false } },
      });
    mocks.run.mockResolvedValue({ success: false, status: 'FAILED' });
    await expect(
      definition.config.handler(
        { records: [{ id: '20202020-9549-49dd-b2b2-883999db8938' }] },
        context,
      ),
    ).rejects.toThrow('unavailable');
  });
});
