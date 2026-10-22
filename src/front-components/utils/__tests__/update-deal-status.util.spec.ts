import { describe, expect, it, vi } from 'vitest';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { updateDealStatus } from '../update-deal-status.util';
describe('direct deal status actions', () => {
  it.each(['WON', 'LOST', 'PAUSED', 'ONGOING'] as const)(
    'changes only the status to %s',
    async (status) => {
      const mutation = vi.fn().mockResolvedValue({});
      await updateDealStatus('deal', status, {
        mutation,
      } as unknown as CoreApiClient);
      expect(mutation).toHaveBeenCalledExactlyOnceWith({
        updateOpportunity: {
          __args: { id: 'deal', data: { dealStatus: status } },
          id: true,
        },
      });
    },
  );
  it('rejects invalid input before writing', async () => {
    const mutation = vi.fn();
    await expect(
      updateDealStatus('', 'WON', { mutation } as unknown as CoreApiClient),
    ).rejects.toThrow();
    expect(mutation).not.toHaveBeenCalled();
  });
  it('propagates permission and network failures', async () => {
    const mutation = vi.fn().mockRejectedValue(new Error('Forbidden'));
    await expect(
      updateDealStatus('deal', 'WON', { mutation } as unknown as CoreApiClient),
    ).rejects.toThrow('Forbidden');
  });
});
