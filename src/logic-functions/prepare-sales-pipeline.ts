import { defineLogicFunction } from 'twenty-sdk/define';
import { prepareSalesPipeline } from 'src/services/prepare-sales-pipeline';

export default defineLogicFunction({
  universalIdentifier: 'd7ff5437-d945-445d-a421-94380d1a5055',
  name: 'prepare-sales-pipeline',
  description:
    'Prepare the native board and ordered stage columns for a selected sales pipeline without changing any deal.',
  timeoutSeconds: 300,
  httpRouteTriggerSettings: {
    path: '/prepare-sales-pipeline',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
  handler: async (
    event: { pipelineId: string } | { body: { pipelineId: string } },
  ) => {
    const payload = 'body' in event ? event.body : event;
    return prepareSalesPipeline(payload?.pipelineId);
  },
});
