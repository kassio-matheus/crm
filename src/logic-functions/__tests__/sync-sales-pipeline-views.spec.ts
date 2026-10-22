import { expect, it, vi } from 'vitest';
import { NativePipelineCatalogSync } from 'src/services/native-pipeline-catalog-sync';
import definition from '../sync-sales-pipeline-views';
it('keeps created and renamed pipelines in the native picker', async () => {
  const spy = vi
    .spyOn(NativePipelineCatalogSync.prototype, 'forPipelines')
    .mockResolvedValue();
  try {
    await definition.config.handler(
      { events: [{ recordId: 'pipeline', properties: {} }] },
      {} as never,
    );
    expect(definition.config.databaseEventTriggerSettings).toEqual({
      eventName: 'salesPipeline.*',
      batchMode: true,
    });
    expect(spy).toHaveBeenCalledWith(['pipeline']);
  } finally {
    spy.mockRestore();
  }
});
