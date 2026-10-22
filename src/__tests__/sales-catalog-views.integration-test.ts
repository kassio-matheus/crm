import { randomUUID } from 'node:crypto';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { afterAll, expect, it } from 'vitest';
const core = new CoreApiClient(),
  metadata = new MetadataApiClient();
const pipelines: string[] = [randomUUID(), randomUUID()];
const alias = randomUUID();
const stages = [randomUUID(), randomUUID()];
const createdPipelines: string[] = [],
  createdStages: string[] = [];
const readGroups = async (id: string) =>
  (
    await metadata.query({
      getViewGroups: {
        __args: { viewId: id },
        id: true,
        fieldValue: true,
        position: true,
        isVisible: true,
      },
    })
  ).getViewGroups;
const visible = async (id: string) =>
  (await readGroups(id))
    .filter((g) => g.fieldValue && g.isVisible)
    .sort((a, b) => a.position - b.position)
    .map((g) => g.fieldValue);
afterAll(async () => {
  for (const id of createdStages)
    await core.mutation({ destroySalesStage: { __args: { id }, id: true } });
  for (const id of createdPipelines) {
    await core.mutation({ destroySalesPipeline: { __args: { id }, id: true } });
  }
  for (const id of [...createdPipelines, alias]) {
    const views = await metadata.query({ getViews: { id: true } });
    if (views.getViews.some((v) => v.id === id))
      await metadata.mutation({ deleteView: { __args: { id } } });
  }
});
it('reconciles real queued catalog events without opening the filter panel: new, hidden, reordered, moved, deleted and restored empty stages', async () => {
  for (const id of pipelines) {
    await core.mutation({
      createSalesPipeline: {
        __args: { data: { id, name: 'Catalog event integration ' + id } },
        id: true,
      },
    });
    createdPipelines.push(id);
  }
  await expect
    .poll(
      async () => {
        const result = await metadata.query({
          getViews: { id: true, icon: true, type: true },
        });
        return result.getViews.filter(
          (v) =>
            pipelines.includes(v.id) &&
            v.icon === 'IconLock' &&
            v.type === 'KANBAN',
        ).length;
      },
      { timeout: 45000, interval: 1500 },
    )
    .toBe(2);
  const canonical = (
    await metadata.query({ getViews: { id: true, objectMetadataId: true } })
  ).getViews.find((v) => v.id === pipelines[0])!;
  const fields = (
    await metadata.query({
      objects: {
        __args: {
          filter: { id: { eq: canonical.objectMetadataId } },
          paging: { first: 1 },
        },
        edges: { node: { fieldsList: { id: true, name: true } } },
      },
    })
  ).objects.edges[0].node.fieldsList!;
  await metadata.mutation({
    createView: {
      __args: {
        input: {
          id: alias,
          objectMetadataId: canonical.objectMetadataId,
          name: 'Existing pipeline alias',
          icon: 'IconLayoutKanban',
          type: 'KANBAN',
          mainGroupByFieldMetadataId: fields.find((f) => f.name === 'stage')!
            .id,
        },
      },
      id: true,
    },
  });
  await metadata.mutation({
    createViewFilter: {
      __args: {
        input: {
          viewId: alias,
          fieldMetadataId: fields.find((f) => f.name === 'salesPipeline')!.id,
          operand: 'IS',
          value: JSON.stringify([pipelines[0]]) as unknown as Record<
            string,
            unknown
          >,
        },
      },
      id: true,
    },
  });
  for (const [index, id] of stages.entries()) {
    await core.mutation({
      createSalesStage: {
        __args: {
          data: {
            id,
            name: 'Empty stage ' + index,
            sourceOrder: index,
            salesPipelineId: pipelines[0],
          },
        },
        id: true,
      },
    });
    createdStages.push(id);
  }
  await expect
    .poll(() => visible(pipelines[0]), { timeout: 45000, interval: 1500 })
    .toEqual(stages);
  await expect
    .poll(() => visible(alias), { timeout: 45000, interval: 1500 })
    .toEqual(stages);
  const group = (await readGroups(pipelines[0])).find(
    (g) => g.fieldValue === stages[1],
  )!;
  await metadata.mutation({
    updateViewGroup: {
      __args: { input: { id: group.id, update: { isVisible: false } } },
      id: true,
    },
  });
  await core.mutation({
    updateSalesStage: {
      __args: { id: stages[1], data: { sourceOrder: -1 } },
      id: true,
    },
  });
  await expect
    .poll(() => visible(pipelines[0]), { timeout: 45000, interval: 1500 })
    .toEqual([stages[1], stages[0]]);
  await core.mutation({
    updateSalesStage: {
      __args: { id: stages[1], data: { salesPipelineId: pipelines[1] } },
      id: true,
    },
  });
  await expect
    .poll(() => visible(pipelines[0]), { timeout: 45000, interval: 1500 })
    .toEqual([stages[0]]);
  await expect
    .poll(() => visible(pipelines[1]), { timeout: 45000, interval: 1500 })
    .toEqual([stages[1]]);
  await core.mutation({
    deleteSalesStage: { __args: { id: stages[0] }, id: true },
  });
  await expect
    .poll(() => visible(pipelines[0]), { timeout: 45000, interval: 1500 })
    .toEqual([]);
  await core.mutation({
    restoreSalesStage: { __args: { id: stages[0] }, id: true },
  });
  await expect
    .poll(() => visible(pipelines[0]), { timeout: 45000, interval: 1500 })
    .toEqual([stages[0]]);
  await core.mutation({
    updateSalesPipeline: {
      __args: { id: pipelines[0], data: { name: 'Renamed managed pipeline' } },
      id: true,
    },
  });
  await expect
    .poll(
      async () =>
        (
          await metadata.query({ getViews: { id: true, name: true } })
        ).getViews.find((v) => v.id === pipelines[0])?.name,
      { timeout: 45000, interval: 1500 },
    )
    .toBe('Renamed managed pipeline');
});
