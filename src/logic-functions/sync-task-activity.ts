import { defineLogicFunction } from 'twenty-sdk/define';
import { NativeSalesMaintenance } from 'src/services/native-sales-maintenance';
import type { SalesChangeBatch } from 'src/types/sales-change-batch';
export default defineLogicFunction({
  universalIdentifier: '331de08e-6826-468f-9aee-e71578563348',
  name: 'sync-task-activity',
  description:
    'Refresh the next pending activity date of native opportunities after task changes.',
  timeoutSeconds: 300,
  databaseEventTriggerSettings: { eventName: 'task.*', batchMode: true },
  handler: async (payload: SalesChangeBatch) =>
    new NativeSalesMaintenance().forTasks(
      payload.events.map((e) => e.recordId),
    ),
});
