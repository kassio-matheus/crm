import { defineLogicFunction } from 'twenty-sdk/define';
import { ImportOwnerReconciler } from 'src/services/import-owner-reconciler';

export default defineLogicFunction({
  universalIdentifier: 'c529007d-6c8c-483f-a11b-2df059a62e58',
  name: 'reconcile-rd-owners',
  description:
    'Administrator-only repair of up to 50 imported deals, companies or tasks. Read current RD owners using GET, resolve confirmed identities or exact emails, and fill only empty native owner fields. Preserve manual assignments and never create records or change the import checkpoint.',
  timeoutSeconds: 900,
  handler: async (payload: unknown) => new ImportOwnerReconciler().run(payload),
});
