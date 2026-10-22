import { describe, expect, it, vi } from 'vitest';
import { NativeSalesMaintenance } from 'src/services/native-sales-maintenance';
import definition from '../sync-task-target-activity';
describe('sync-task-target-activity', () => {
  it('dispatches a native database batch', async () => {
    const spy = vi
      .spyOn(NativeSalesMaintenance.prototype, 'refreshNextActivity')
      .mockResolvedValue(undefined);
    await definition.config.handler(
      {
        events: [
          {
            recordId: 'link',
            properties: {
              before: { targetOpportunityId: 'old' },
              after: { targetOpportunityId: 'new' },
            },
          },
        ],
      },
      {} as never,
    );
    expect(spy).toHaveBeenCalledWith(['old', 'new']);
    spy.mockRestore();
  });
});
