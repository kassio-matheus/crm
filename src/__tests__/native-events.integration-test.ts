import { randomUUID } from 'node:crypto';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { afterAll, describe, expect, it } from 'vitest';
const client = new CoreApiClient();
const ids = {
  deal: randomUUID(),
  task: randomUUID(),
  target: randomUUID(),
  pipeline: randomUUID(),
  otherPipeline: randomUUID(),
  stage: randomUUID(),
};
const created = new Set<string>();
afterAll(async () => {
  if (created.has('target'))
    await client.mutation({
      destroyTaskTarget: { __args: { id: ids.target }, id: true },
    });
  if (created.has('task'))
    await client.mutation({
      destroyTask: { __args: { id: ids.task }, id: true },
    });
  if (created.has('deal'))
    await client.mutation({
      destroyOpportunity: { __args: { id: ids.deal }, id: true },
    });
  if (created.has('stage'))
    await client.mutation({
      destroySalesStage: { __args: { id: ids.stage }, id: true },
    });
  for (const key of ['pipeline', 'otherPipeline'] as const)
    if (created.has(key))
      await client.mutation({
        destroySalesPipeline: { __args: { id: ids[key] }, id: true },
      });
  const metadata = new MetadataApiClient();
  const views = await metadata.query({ getViews: { id: true } });
  for (const id of [ids.pipeline, ids.otherPipeline])
    if (views.getViews.some((view) => view.id === id))
      await metadata.mutation({ deleteView: { __args: { id } } });
});
describe('Native database-event execution', () => {
  it('maintains task ordering and pipeline consistency using the actual queued app functions', async () => {
    for (const key of ['pipeline', 'otherPipeline'] as const) {
      await client.mutation({
        createSalesPipeline: {
          __args: { data: { id: ids[key], name: 'Native event test' } },
          id: true,
        },
      });
      created.add(key);
    }
    await client.mutation({
      createSalesStage: {
        __args: {
          data: {
            id: ids.stage,
            name: 'Native event stage',
            salesPipelineId: ids.otherPipeline,
          },
        },
        id: true,
      },
    });
    created.add('stage');
    await client.mutation({
      createOpportunity: {
        __args: {
          data: {
            id: ids.deal,
            name: 'Native event test',
            salesPipelineId: ids.pipeline,
            dealStatus: 'LOST',
            salesStageKey: 'original-source-stage',
          },
        },
        id: true,
      },
    });
    created.add('deal');
    await client.mutation({
      createTask: {
        __args: {
          data: {
            id: ids.task,
            title: 'Native event task',
            dueAt: '2026-12-30T12:00:00Z',
            status: 'TODO',
          },
        },
        id: true,
      },
    });
    created.add('task');
    await client.mutation({
      createTaskTarget: {
        __args: {
          data: {
            id: ids.target,
            taskId: ids.task,
            targetOpportunityId: ids.deal,
          },
        },
        id: true,
      },
    });
    created.add('target');
    const read = async () => {
      const result = await client.query({
        opportunities: {
          __args: { first: 1, filter: { id: { eq: ids.deal } } },
          edges: {
            node: {
              nextActivityAt: true,
              salesPipelineId: true,
              salesStageKey: true,
              dealStatus: true,
            },
          },
        },
      });
      return result.opportunities!.edges[0]?.node;
    };
    await expect
      .poll(async () => (await read())?.nextActivityAt, {
        timeout: 45000,
        interval: 1500,
      })
      .toBe('2026-12-30T12:00:00.000Z');
    await client.mutation({
      updateTask: {
        __args: { id: ids.task, data: { status: 'DONE' } },
        id: true,
      },
    });
    await expect
      .poll(async () => (await read())?.nextActivityAt, {
        timeout: 45000,
        interval: 1500,
      })
      .toBeNull();
    await client.mutation({
      updateOpportunity: {
        __args: { id: ids.deal, data: { salesStageId: ids.stage } },
        id: true,
      },
    });
    await expect
      .poll(async () => (await read())?.salesPipelineId, {
        timeout: 45000,
        interval: 1500,
      })
      .toBe(ids.otherPipeline);
    expect(await read()).toMatchObject({
      dealStatus: 'LOST',
      salesStageKey: 'original-source-stage',
    });
  });
});
