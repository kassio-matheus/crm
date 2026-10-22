import { defineLogicFunction } from 'twenty-sdk/define';
import { NativeSalesMaintenance } from 'src/services/native-sales-maintenance';
import type { SalesChangeBatch } from 'src/types/sales-change-batch';
export default defineLogicFunction({
  universalIdentifier: 'ac971405-f11d-48ce-af64-12e7635ceca8',
  name: 'sync-sales-pipeline',
  description:
    'Keep the native pipeline consistent with the selected stage after native kanban moves and inline edits.',
  timeoutSeconds: 300,
  databaseEventTriggerSettings: {
    eventName: 'opportunity.updated',
    batchMode: true,
  },
  handler: async (payload: SalesChangeBatch) => {
    const maintenance = new NativeSalesMaintenance();
    for (const event of payload.events) {
      const fields = event.properties.updatedFields ?? [];
      const stageChanged = fields.some((f) =>
        ['salesStage', 'salesStageId'].includes(f),
      );
      if (
        stageChanged ||
        fields.some((f) => ['salesPipeline', 'salesPipelineId'].includes(f))
      )
        await maintenance.syncPipeline(event.recordId, stageChanged);
    }
  },
});
