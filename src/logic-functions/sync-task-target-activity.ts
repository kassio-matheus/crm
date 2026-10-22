import { defineLogicFunction } from 'twenty-sdk/define';
import { NativeSalesMaintenance } from 'src/services/native-sales-maintenance';
import type { SalesChangeBatch } from 'src/types/sales-change-batch';
export default defineLogicFunction({
  universalIdentifier: '03b80429-be1b-44ff-b96c-7d4ecd4041b3',
  name: 'sync-task-target-activity',
  description:
    'Refresh next activity dates when a native task is linked, unlinked or moved between opportunities.',
  timeoutSeconds: 300,
  databaseEventTriggerSettings: { eventName: 'taskTarget.*', batchMode: true },
  handler: async (payload: SalesChangeBatch) =>
    new NativeSalesMaintenance().refreshNextActivity(
      payload.events
        .flatMap((e) => [
          e.properties.before?.targetOpportunityId,
          e.properties.after?.targetOpportunityId,
        ])
        .filter((id): id is string => !!id),
    ),
});
