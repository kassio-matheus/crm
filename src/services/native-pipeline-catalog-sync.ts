import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { NativePipelineViews } from 'src/services/native-pipeline-views';
import { prepareSalesPipeline } from 'src/services/prepare-sales-pipeline';
import type { SalesCatalogChangeBatch } from 'src/types/sales-catalog-change-batch';

/** Catalog changes reconcile view metadata only, including both sides of a stage move. */
export class NativePipelineCatalogSync {
  constructor(
    private client = new CoreApiClient({ runAs: 'application' }),
    private views = new NativePipelineViews(
      new MetadataApiClient({ runAs: 'application' }),
    ),
  ) {}

  async forStages({ events }: SalesCatalogChangeBatch) {
    const pipelines = new Set<string>();
    for (const event of events) {
      for (const record of [event.properties.before, event.properties.after])
        if (record?.salesPipelineId) pipelines.add(record.salesPipelineId);
      // Reading the current record also covers restore events and relation-only payloads.
      const current = await this.client.query({
        salesStages: {
          __args: { first: 1, filter: { id: { eq: event.recordId } } },
          edges: { node: { salesPipelineId: true } },
        },
      });
      const pipeline = current.salesStages?.edges[0]?.node.salesPipelineId;
      if (pipeline) pipelines.add(pipeline);
    }
    await this.forPipelines([...pipelines]);
  }

  async forPipelines(ids: string[]) {
    for (const id of new Set(ids)) {
      const result = await this.client.query({
        salesPipelines: {
          __args: { first: 1, filter: { id: { eq: id } } },
          edges: { node: { id: true } },
        },
      });
      // Deleted pipelines are not recreated by their queued catalog events.
      if (result.salesPipelines?.edges.length)
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await prepareSalesPipeline(id, this.client, this.views);
            break;
          } catch (error) {
            // Import and catalog events can race to create the same deterministic
            // view/group ID. Re-read the catalog and metadata; never duplicate it.
            if (attempt === 2) throw error;
            await new Promise((resolve) =>
              setTimeout(resolve, 250 * (attempt + 1)),
            );
          }
        }
    }
  }
}
