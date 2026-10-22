import { describe, it, expect, vi } from 'vitest';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { NativePipelineViews } from '../native-pipeline-views';
import { prepareSalesPipeline } from '../prepare-sales-pipeline';
const id = 'd7ff5437-d945-445d-a421-94380d1a5055';
describe('pipeline selection', () => {
  it('includes every stage across pages, keeps order and never writes business records', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ salesPipeline: { id, name: 'Vendas' } })
      .mockResolvedValueOnce({
        salesStages: {
          edges: [{ node: { id: 'a', name: 'Contato', sourceOrder: 0 } }],
          pageInfo: { hasNextPage: true, endCursor: 'cursor' },
        },
      })
      .mockResolvedValueOnce({
        salesStages: {
          edges: [{ node: { id: 'b', name: 'Proposta', sourceOrder: 1 } }],
          pageInfo: { hasNextPage: false },
        },
      });
    const mutation = vi.fn(),
      ensure = vi.fn(),
      syncStages = vi.fn();
    const result = await prepareSalesPipeline(
      id,
      { query, mutation } as unknown as CoreApiClient,
      { ensure, syncStages } as unknown as NativePipelineViews,
    );
    expect(result.stages.map((s) => s.name)).toEqual(['Contato', 'Proposta']);
    expect(syncStages).toHaveBeenCalledWith(id, result.stages);
    expect(mutation).not.toHaveBeenCalled();
    expect(query.mock.calls[1][0].salesStages.__args.filter).toEqual({
      salesPipelineId: { eq: id },
    });
  });
  it('rejects missing or unauthorized pipelines without provisioning', async () => {
    const ensure = vi.fn(),
      query = vi.fn().mockResolvedValue({ salesPipeline: null });
    await expect(
      prepareSalesPipeline(
        id,
        { query } as unknown as CoreApiClient,
        { ensure } as unknown as NativePipelineViews,
      ),
    ).rejects.toThrow('not found');
    expect(ensure).not.toHaveBeenCalled();
    await expect(prepareSalesPipeline('invalid')).rejects.toThrow('identifier');
  });
});
