import { defineLogicFunction } from 'twenty-sdk/define';
import { IMPORT_CONTROL } from 'src/constants/rd-identifiers';
import { ImportCoordinator } from 'src/services/import-coordinator';

export default defineLogicFunction({
  universalIdentifier: IMPORT_CONTROL,
  name: 'rd-import',
  description:
    'Admin-only control of a create-only RD Station CRM migration. Simulate, start, pause, resume, or read its persistent checkpoint. Never accepts API credentials as a logged function payload.',
  timeoutSeconds: 60,
  httpRouteTriggerSettings: {
    path: '/rd-import',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
  handler: async (
    event:
      | { action: 'status' | 'simulate' | 'start' | 'pause' | 'resume' }
      | {
          body: {
            action: 'status' | 'simulate' | 'start' | 'pause' | 'resume';
          };
        },
  ) => {
    const payload = event && 'body' in event ? event.body : event;
    if (
      !payload ||
      !['status', 'simulate', 'start', 'pause', 'resume'].includes(
        payload.action,
      )
    )
      throw new Error('Invalid import action.');
    return new ImportCoordinator().control(payload.action);
  },
});
