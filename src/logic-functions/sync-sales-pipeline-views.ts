import { defineLogicFunction } from 'twenty-sdk/define';
import { NativePipelineCatalogSync } from 'src/services/native-pipeline-catalog-sync';
import type { SalesCatalogChangeBatch } from 'src/types/sales-catalog-change-batch';

export default defineLogicFunction({
  universalIdentifier: '7c9033c7-07cc-4c5b-b236-0226fc2886ef',
  name: 'sync-sales-pipeline-views',
  description:
    'Create and refresh the managed native board when a sales pipeline is created, renamed or restored.',
  timeoutSeconds: 300,
  databaseEventTriggerSettings: {
    eventName: 'salesPipeline.*',
    batchMode: true,
  },
  handler: async ({ events }: SalesCatalogChangeBatch) =>
    new NativePipelineCatalogSync().forPipelines(
      events.map((event) => event.recordId),
    ),
});
