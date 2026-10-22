import { describe, expect, it, vi } from 'vitest';
import { NativeSalesMaintenance } from 'src/services/native-sales-maintenance';
import definition from '../sync-task-activity';
describe('sync-task-activity', () => {
  it('dispatches a native database batch', async () => {
    const spy = vi
      .spyOn(NativeSalesMaintenance.prototype, 'forTasks')
      .mockResolvedValue(undefined);
    await definition.config.handler(
      { events: [{ recordId: 'task', properties: {} }] },
      {} as never,
    );
    expect(spy).toHaveBeenCalledWith(['task']);
    spy.mockRestore();
  });
});
