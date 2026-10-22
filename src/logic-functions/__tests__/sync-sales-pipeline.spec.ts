import { describe, expect, it, vi } from 'vitest';
import { NativeSalesMaintenance } from 'src/services/native-sales-maintenance';
import definition from '../sync-sales-pipeline';
describe('sync-sales-pipeline', () => {
  it('dispatches a native database batch', async () => {
    const spy = vi
      .spyOn(NativeSalesMaintenance.prototype, 'syncPipeline')
      .mockResolvedValue(undefined);
    await definition.config.handler(
      {
        events: [
          { recordId: 'deal', properties: { updatedFields: ['salesStageId'] } },
        ],
      },
      {} as never,
    );
    expect(spy).toHaveBeenCalledWith('deal', true);
    spy.mockRestore();
  });
});
