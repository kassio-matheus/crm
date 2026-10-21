import { defineLogicFunction } from 'twenty-sdk/define';

// Logic function handler - rename and implement your logic
const handler = async (params: {
  a: string;
  b: number;
}): Promise<{ message: string }> => {
  const { a, b } = params;

  // Replace with your own logic
  const message = `Hello, input: ${a} and ${b}`;

  return { message };
};

export default defineLogicFunction({
  universalIdentifier: '2295d8e4-ea4d-4772-a09a-37e6b040042a',
  name: 'rd-import',
  description: 'Add a description for your logic function',
  timeoutSeconds: 5,
  handler,
    // Add your trigger here
    // Route trigger example:
    // httpRouteTriggerSettings: {
    //   path: '/rd-import',
    //   httpMethod: 'POST',
    //   isAuthRequired: true,
    // },
    // Cron trigger example:
    // cronTriggerSettings: {
    //   pattern: '0 0 * * *', // Daily at midnight
    // },
    // Database event trigger example:
    // databaseEventTriggerSettings: {
    //   eventName: 'objectName.created',
    //   // Optional: receive one call per batch of events instead of one per event,
    //   // the handler payload then becomes { ...eventInfo, events: [...] }
    //   batchMode: true,
    // },
});
