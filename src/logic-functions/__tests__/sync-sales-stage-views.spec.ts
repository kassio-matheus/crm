import { expect, it, vi } from 'vitest';
import { NativePipelineCatalogSync } from 'src/services/native-pipeline-catalog-sync';
import definition from '../sync-sales-stage-views';
it('registers and forwards every native stage lifecycle event', async () => {
  const spy = vi
    .spyOn(NativePipelineCatalogSync.prototype, 'forStages')
    .mockResolvedValue();
  const payload = { events: [{ recordId: 'stage', properties: {} }] };
  try {
    await definition.config.handler(payload, {} as never);
    expect(definition.config.databaseEventTriggerSettings).toEqual({
      eventName: 'salesStage.*',
      batchMode: true,
    });
    expect(spy).toHaveBeenCalledWith(payload);
  } finally {
    spy.mockRestore();
  }
});
