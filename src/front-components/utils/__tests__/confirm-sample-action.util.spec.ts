import { beforeEach, expect, it, vi } from 'vitest';
const modal = vi.hoisted(() => vi.fn());
vi.mock('twenty-sdk/front-component', () => ({
  openCommandConfirmationModal: modal,
}));
import { confirmSampleAction } from '../confirm-sample-action.util';
import { importState } from 'src/__tests__/fixtures/import-state';
const state = () =>
  importState({
    status: 'COMPLETED',
    selection: {
      scope: 'sample',
      limit: 25,
      cutoff: '2026-10-24T00:00:00Z',
      selectedDeals: ['one'],
    },
    preview: { runId: 'run', status: 'AVAILABLE', owned: 5, removed: 0 },
  });
beforeEach(() => modal.mockReset());
it('requires a completed recent simulation before creating real sample data', async () => {
  expect(await confirmSampleAction('sample', importState())).toBe(false);
  expect(modal).not.toHaveBeenCalled();
  modal.mockResolvedValueOnce('confirm');
  expect(await confirmSampleAction('sample', state())).toBe(true);
});
it('offers bounded sample deletion and honors cancellation', async () => {
  modal.mockResolvedValueOnce('cancel');
  expect(await confirmSampleAction('cleanup', state())).toBe(false);
  expect(modal).toHaveBeenCalledWith(
    expect.objectContaining({ confirmButtonText: 'Excluir dados da amostra' }),
  );
});
it('never offers deletion after full import promotion', async () => {
  const current = state();
  current.preview!.status = 'PROMOTED';
  expect(await confirmSampleAction('cleanup', current)).toBe(false);
  expect(modal).not.toHaveBeenCalled();
});
