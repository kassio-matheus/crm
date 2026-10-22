import { defineLogicFunction } from 'twenty-sdk/define';
import { NativePipelineCatalogSync } from 'src/services/native-pipeline-catalog-sync';
import type { SalesCatalogChangeBatch } from 'src/types/sales-catalog-change-batch';

export default defineLogicFunction({
  universalIdentifier: '80704b97-39d6-40db-8f48-924f2f56f2e6',
  name: 'sync-sales-stage-views',
  description:
    'Keep every native pipeline column visible and ordered after a stage is created, edited, moved, deleted or restored.',
  timeoutSeconds: 300,
  databaseEventTriggerSettings: { eventName: 'salesStage.*', batchMode: true },
  handler: async (payload: SalesCatalogChangeBatch) =>
    new NativePipelineCatalogSync().forStages(payload),
});
