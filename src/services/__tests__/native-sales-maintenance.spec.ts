import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { NativeSalesMaintenance } from '../native-sales-maintenance';
const query = vi.fn(),
  mutation = vi.fn();
const service = new NativeSalesMaintenance({
  query,
  mutation,
} as unknown as CoreApiClient);
beforeEach(() => {
  query.mockReset();
  mutation.mockReset();
  mutation.mockResolvedValue({});
});
describe('native sales derived fields', () => {
  it('finds the first pending task across pages and ignores completed or deleted tasks', async () => {
    query
      .mockResolvedValueOnce({
        opportunities: { edges: [{ node: { id: 'd', nextActivityAt: null } }] },
      })
      .mockResolvedValueOnce({
        taskTargets: {
          edges: [
            { node: { task: { dueAt: '2027-01-01', status: 'DONE' } } },
            {
              node: {
                task: {
                  dueAt: '2026-01-01',
                  status: 'TODO',
                  deletedAt: '2026-01-01',
                },
              },
            },
            { node: { task: { dueAt: '2027-03-01', status: 'TODO' } } },
          ],
          pageInfo: { hasNextPage: true, endCursor: 'next' },
        },
      })
      .mockResolvedValueOnce({
        taskTargets: {
          edges: [{ node: { task: { dueAt: '2027-02-01', status: 'TODO' } } }],
          pageInfo: { hasNextPage: false },
        },
      });
    await service.refreshNextActivity(['d']);
    expect(mutation).toHaveBeenCalledWith({
      updateOpportunity: {
        __args: { id: 'd', data: { nextActivityAt: '2027-02-01' } },
        id: true,
      },
    });
  });
  it('clears a derived date when no pending task remains', async () => {
    query
      .mockResolvedValueOnce({
        opportunities: {
          edges: [{ node: { id: 'd', nextActivityAt: '2027-01-01' } }],
        },
      })
      .mockResolvedValueOnce({
        taskTargets: { edges: [], pageInfo: { hasNextPage: false } },
      });
    await service.refreshNextActivity(['d', 'd']);
    expect(mutation).toHaveBeenCalledTimes(1);
    expect(mutation.mock.calls[0][0].updateOpportunity.__args.data).toEqual({
      nextActivityAt: null,
    });
  });
  it('does not write when the derived date is unchanged', async () => {
    query
      .mockResolvedValueOnce({
        opportunities: { edges: [{ node: { id: 'd', nextActivityAt: null } }] },
      })
      .mockResolvedValueOnce({
        taskTargets: { edges: [], pageInfo: { hasNextPage: false } },
      });
    await service.refreshNextActivity(['d']);
    expect(mutation).not.toHaveBeenCalled();
  });
  it('deduplicates task targets and tolerates a removed opportunity', async () => {
    query
      .mockResolvedValueOnce({
        taskTargets: {
          edges: [
            { node: { targetOpportunityId: 'd' } },
            { node: { targetOpportunityId: 'd' } },
          ],
          pageInfo: { hasNextPage: false },
        },
      })
      .mockResolvedValueOnce({ opportunities: { edges: [] } });
    await service.forTasks(['t', 't']);
    expect(query).toHaveBeenCalledTimes(2);
    expect(mutation).not.toHaveBeenCalled();
  });
  it('moves the pipeline when a stage is changed using native drag and drop', async () => {
    query.mockResolvedValueOnce({
      opportunities: {
        edges: [
          {
            node: {
              salesPipelineId: 'old',
              salesStageId: 'stage',
              salesStage: { salesPipelineId: 'new' },
            },
          },
        ],
      },
    });
    await service.syncPipeline('d', true);
    expect(mutation.mock.calls[0][0].updateOpportunity.__args.data).toEqual({
      salesPipelineId: 'new',
    });
  });
  it('clears an incompatible stage after an explicit pipeline edit', async () => {
    query.mockResolvedValueOnce({
      opportunities: {
        edges: [
          {
            node: {
              salesPipelineId: 'new',
              salesStageId: 'stage',
              salesStage: { salesPipelineId: 'old' },
            },
          },
        ],
      },
    });
    await service.syncPipeline('d', false);
    expect(mutation.mock.calls[0][0].updateOpportunity.__args.data).toEqual({
      salesStageId: null,
    });
  });
  it('preserves aligned pipelines and never touches source snapshots', async () => {
    query.mockResolvedValueOnce({
      opportunities: {
        edges: [
          {
            node: {
              salesPipelineId: 'p',
              salesStageId: 's',
              salesStage: { salesPipelineId: 'p' },
            },
          },
        ],
      },
    });
    await service.syncPipeline('d', true);
    expect(mutation).not.toHaveBeenCalled();
  });
});
