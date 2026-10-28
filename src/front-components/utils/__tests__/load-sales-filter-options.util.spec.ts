import { describe, expect, it, vi } from 'vitest';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { NATIVE_SALES } from 'src/constants/native-sales';
import { loadSalesFilterOptions } from '../load-sales-filter-options.util';
const metadata = () =>
  ({
    query: vi.fn().mockResolvedValue({
      getViews: ['board', 'pipelineBoard', 'list'].map((k) => ({
        id: k,
        universalIdentifier: NATIVE_SALES[k as 'board'],
      })),
    }),
  }) as unknown as MetadataApiClient;
describe('sales filter catalogs', () => {
  it('paginates catalogs only, without downloading deals or writing records', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        salesPipelines: {
          edges: [{ node: { id: 'p', name: 'Vendas' } }],
          pageInfo: { hasNextPage: true, endCursor: 'next' },
        },
      })
      .mockResolvedValueOnce({
        salesPipelines: {
          edges: [{ node: { id: 'p2', name: 'Retorno' } }],
          pageInfo: { hasNextPage: false },
        },
      })
      .mockResolvedValueOnce({
        salesStages: {
          edges: [
            {
              node: {
                id: 's',
                name: 'Proposta',
                salesPipelineId: 'p',
                sourceOrder: 1,
              },
            },
          ],
          pageInfo: { hasNextPage: false },
        },
      })
      .mockResolvedValueOnce({
        workspaceMembers: {
          edges: [
            {
              node: { id: 'u', name: { firstName: 'Ana', lastName: 'Silva' } },
            },
          ],
          pageInfo: { hasNextPage: false },
        },
      });
    const result = await loadSalesFilterOptions(
      { query } as unknown as CoreApiClient,
      metadata(),
    );
    expect(result.pipelines).toHaveLength(2);
    expect(result.stages).toEqual([
      { id: 's', name: 'Proposta', pipelineId: 'p', order: 1 },
    ]);
    expect(result.members).toEqual([{ id: 'u', name: 'Ana Silva' }]);
    expect(query.mock.calls.every(([request]) => !request.opportunities)).toBe(
      true,
    );
  });
  it('stops repeated cursors instead of looping', async () => {
    const query = vi.fn().mockResolvedValue({
      salesPipelines: {
        edges: [],
        pageInfo: { hasNextPage: true, endCursor: 'same' },
      },
    });
    await expect(
      loadSalesFilterOptions({ query } as unknown as CoreApiClient, metadata()),
    ).rejects.toThrow('pagination');
  });
  it('reports a missing native view', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        salesPipelines: { edges: [], pageInfo: { hasNextPage: false } },
      })
      .mockResolvedValueOnce({
        salesStages: {
          edges: [
            {
              node: {
                id: 's',
                name: 'Proposta',
                salesPipelineId: 'p',
                sourceOrder: 1,
              },
            },
          ],
          pageInfo: { hasNextPage: false },
        },
      })
      .mockResolvedValueOnce({
        workspaceMembers: { edges: [], pageInfo: { hasNextPage: false } },
      });
    await expect(
      loadSalesFilterOptions(
        { query } as unknown as CoreApiClient,
        {
          query: vi.fn().mockResolvedValue({ getViews: [] }),
        } as unknown as MetadataApiClient,
      ),
    ).rejects.toThrow('view is missing');
  });
});
