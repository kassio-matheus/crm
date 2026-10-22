import { randomUUID } from 'node:crypto';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { afterAll, describe, expect, it } from 'vitest';
import { updateDealStatus } from 'src/front-components/utils/update-deal-status.util';
const core = new CoreApiClient(),
  metadata = new MetadataApiClient();
const pipeline = randomUUID(),
  other = randomUUID(),
  deal = randomUUID();
const stages = [randomUUID(), randomUUID(), randomUUID()];
const created: { object: string; id: string }[] = [];
afterAll(async () => {
  for (const item of created.reverse()) {
    if (item.object === 'deal')
      await core.mutation({
        destroyOpportunity: { __args: { id: item.id }, id: true },
      });
    if (item.object === 'stage')
      await core.mutation({
        destroySalesStage: { __args: { id: item.id }, id: true },
      });
    if (item.object === 'pipeline') {
      if (item.id === pipeline)
        await metadata.mutation({ deleteView: { __args: { id: pipeline } } });
      await core.mutation({
        destroySalesPipeline: { __args: { id: item.id }, id: true },
      });
    }
  }
});
describe('native pipeline selection and direct status actions', () => {
  it('executes the deployed selector, includes empty ordered stages only from that pipeline and preserves the deal during status changes', async () => {
    for (const id of [pipeline, other]) {
      await core.mutation({
        createSalesPipeline: {
          __args: { data: { id, name: 'Pipeline selector integration' } },
          id: true,
        },
      });
      created.push({ object: 'pipeline', id });
    }
    for (const [index, id] of stages.entries()) {
      await core.mutation({
        createSalesStage: {
          __args: {
            data: {
              id,
              name:
                index === 0
                  ? 'Proposta'
                  : index === 1
                    ? 'Contato'
                    : 'Outro funil',
              sourceOrder: index === 0 ? 2 : 0,
              salesPipelineId: index === 2 ? other : pipeline,
            },
          },
          id: true,
        },
      });
      created.push({ object: 'stage', id });
    }
    const payload = (await new RestApiClient().post(
      '/s/prepare-sales-pipeline',
      { pipelineId: pipeline },
    )) as { viewId: string; stages: { id: string }[] };
    expect(payload.viewId).toBe(pipeline);
    expect(payload.stages.map((s) => s.id)).toEqual([stages[1], stages[0]]);
    const groups = await metadata.query({
      getViewGroups: {
        __args: { viewId: pipeline },
        fieldValue: true,
        position: true,
        isVisible: true,
      },
    });
    expect(
      groups.getViewGroups
        .filter((g) => g.fieldValue)
        .map((g) => g.fieldValue)
        .sort(),
    ).toEqual(stages.slice(0, 2).sort());
    expect(
      groups.getViewGroups
        .filter((g) => g.fieldValue)
        .every((g) => g.isVisible),
    ).toBe(true);
    const view = await metadata.query({
      getViews: { id: true, shouldHideEmptyGroups: true },
    });
    expect(
      view.getViews.find((v) => v.id === pipeline)?.shouldHideEmptyGroups,
    ).toBe(false);
    await core.mutation({
      createOpportunity: {
        __args: {
          data: {
            id: deal,
            name: 'Direct status integration',
            salesPipelineId: pipeline,
            salesStageId: stages[1],
            amount: { amountMicros: 123450000, currencyCode: 'BRL' },
            salesStageKey: 'keep-source',
          },
        },
        id: true,
      },
    });
    created.push({ object: 'deal', id: deal });
    for (const status of ['PAUSED', 'ONGOING', 'LOST', 'WON'] as const) {
      await updateDealStatus(deal, status, core);
      const record = await core.query({
        opportunity: {
          __args: { filter: { id: { eq: deal } } },
          dealStatus: true,
          salesStageId: true,
          salesPipelineId: true,
          salesStageKey: true,
          amount: { amountMicros: true, currencyCode: true },
        },
      });
      expect(record.opportunity).toMatchObject({
        dealStatus: status,
        salesStageId: stages[1],
        salesPipelineId: pipeline,
        salesStageKey: 'keep-source',
        amount: { amountMicros: 123450000, currencyCode: 'BRL' },
      });
    }
  });
});
