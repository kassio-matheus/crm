import { defineLogicFunction } from 'twenty-sdk/define';
import { IMPORT_CONTROL } from 'src/constants/rd-identifiers';
import { ImportCoordinator } from 'src/services/import-coordinator';
import type { ImportAction } from 'src/types/import-action';

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
      | { action: ImportAction }
      | {
          body: {
            action: ImportAction;
          };
        },
  ) => {
    const payload = event && 'body' in event ? event.body : event;
    if (
      !payload ||
      ![
        'status',
        'simulate',
        'sample',
        'start',
        'cleanup',
        'pause',
        'resume',
      ].includes(payload.action)
    )
      throw new Error('Invalid import action.');
    return new ImportCoordinator().control(payload.action);
  },
});
