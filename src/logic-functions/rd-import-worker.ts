import { defineLogicFunction } from 'twenty-sdk/define';
import { IMPORT_WORKER } from 'src/constants/rd-identifiers';
import { ImportWorker } from 'src/services/import-worker';

export default defineLogicFunction({
  universalIdentifier: IMPORT_WORKER,
  name: 'rd-import-worker',
  description:
    'Process one RD Station CRM page at a time using durable checkpoints, create-only deterministic records and a paced background job chain.',
  timeoutSeconds: 900,
  handler: async (payload: {
    revision?: number;
    command?: 'live' | 'continue';
    jobId?: string;
    runId?: string;
  }) => new ImportWorker().run(payload),
});
