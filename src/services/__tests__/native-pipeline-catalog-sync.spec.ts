import { beforeEach, expect, it, vi } from 'vitest';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { NativePipelineViews } from '../native-pipeline-views';
import { NativePipelineCatalogSync } from '../native-pipeline-catalog-sync';
import { prepareSalesPipeline } from '../prepare-sales-pipeline';
vi.mock('../prepare-sales-pipeline', () => ({ prepareSalesPipeline: vi.fn() }));
const query = vi.fn();
const views = {} as NativePipelineViews;
const sync = new NativePipelineCatalogSync(
  { query } as unknown as CoreApiClient,
  views,
);
beforeEach(() => {
  query.mockReset();
  vi.mocked(prepareSalesPipeline).mockReset();
});
it('reconciles both pipelines after a stage move and deduplicates a batch', async () => {
  query
    .mockResolvedValueOnce({
      salesStages: { edges: [{ node: { salesPipelineId: 'new' } }] },
    })
    .mockResolvedValueOnce({ salesStages: { edges: [] } })
    .mockResolvedValue({
      salesPipelines: { edges: [{ node: { id: 'existing' } }] },
    });
  await sync.forStages({
    events: [
      {
        recordId: 'stage',
        properties: {
          before: { salesPipelineId: 'old' },
          after: { salesPipelineId: 'new' },
        },
      },
      {
        recordId: 'deleted',
        properties: { before: { salesPipelineId: 'old' } },
      },
    ],
  });
  expect(vi.mocked(prepareSalesPipeline).mock.calls.map(([id]) => id)).toEqual([
    'old',
    'new',
  ]);
});
it('does not recreate a deleted pipeline', async () => {
  query.mockResolvedValue({ salesPipelines: { edges: [] } });
  await sync.forPipelines(['deleted', 'deleted']);
  expect(query).toHaveBeenCalledTimes(1);
  expect(prepareSalesPipeline).not.toHaveBeenCalled();
});
it('reads the current stage when a restore payload has no pipeline', async () => {
  query
    .mockResolvedValueOnce({
      salesStages: { edges: [{ node: { salesPipelineId: 'restored' } }] },
    })
    .mockResolvedValueOnce({
      salesPipelines: { edges: [{ node: { id: 'restored' } }] },
    });
  await sync.forStages({ events: [{ recordId: 'stage', properties: {} }] });
  expect(prepareSalesPipeline).toHaveBeenCalledWith(
    'restored',
    expect.anything(),
    views,
  );
});
it('re-reads metadata after a concurrent create and surfaces persistent failures', async () => {
  query.mockResolvedValue({
    salesPipelines: { edges: [{ node: { id: 'p' } }] },
  });
  vi.mocked(prepareSalesPipeline)
    .mockRejectedValueOnce(new Error('concurrent create'))
    .mockResolvedValueOnce({ viewId: 'p', stages: [] });
  await sync.forPipelines(['p']);
  expect(prepareSalesPipeline).toHaveBeenCalledTimes(2);
  vi.mocked(prepareSalesPipeline)
    .mockReset()
    .mockRejectedValue(new Error('permission denied'));
  await expect(sync.forPipelines(['p'])).rejects.toThrow('permission denied');
  expect(prepareSalesPipeline).toHaveBeenCalledTimes(3);
});
