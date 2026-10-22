import { CoreApiClient } from 'twenty-client-sdk/core';
import { NativePipelineViews } from 'src/services/native-pipeline-views';

/** Provision metadata only. A pipeline selection never changes a deal. */
export const prepareSalesPipeline = async (
  pipelineId: string,
  client = new CoreApiClient(),
  views = new NativePipelineViews(),
) => {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[4-9a-f][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      pipelineId,
    )
  )
    throw new Error('Invalid pipeline identifier.');
  const result = await client.query({
    salesPipeline: {
      __args: { filter: { id: { eq: pipelineId } } },
      id: true,
      name: true,
    },
  });
  if (!result.salesPipeline) throw new Error('Pipeline not found.');
  await views.ensure(
    pipelineId,
    result.salesPipeline.name || 'Funil de vendas',
  );
  const stages: { id: string; name: string; order: number }[] = [];
  let cursor: string | null = null;
  do {
    const page: {
      salesStages?: {
        edges: {
          node: {
            id: string;
            name?: string | null;
            sourceOrder?: number | null;
          };
        }[];
        pageInfo: { hasNextPage: boolean; endCursor?: string | null };
      };
    } = await client.query({
      salesStages: {
        __args: {
          first: 100,
          after: cursor,
          filter: { salesPipelineId: { eq: pipelineId } },
          orderBy: [
            { sourceOrder: 'AscNullsLast' },
            { name: 'AscNullsLast' },
            { id: 'AscNullsLast' },
          ],
        },
        edges: { node: { id: true, name: true, sourceOrder: true } },
        pageInfo: { hasNextPage: true, endCursor: true },
      },
    });
    for (const { node } of page.salesStages!.edges)
      stages.push({
        id: node.id,
        name: node.name || 'Etapa',
        order: node.sourceOrder ?? stages.length,
      });
    const next: string | null = page.salesStages!.pageInfo.hasNextPage
      ? (page.salesStages!.pageInfo.endCursor ?? null)
      : null;
    if (next && next === cursor)
      throw new Error('Stage pagination did not advance.');
    cursor = next;
  } while (cursor);
  await views.syncStages(pipelineId, stages);
  return { viewId: pipelineId, stages };
};
