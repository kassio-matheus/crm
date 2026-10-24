import { expect, it, vi } from 'vitest';
const modal = vi.hoisted(() => vi.fn());
vi.mock('twenty-sdk/front-component', () => ({
  openCommandConfirmationModal: modal,
}));
import { confirmImportStart } from '../confirm-import-start.util';
import { importState } from 'src/__tests__/fixtures/import-state';
it('never offers live import before a completed simulation', async () => {
  expect(await confirmImportStart(null)).toBe(false);
  expect(await confirmImportStart(importState())).toBe(false);
  expect(
    await confirmImportStart(
      importState({ dryRun: false, status: 'COMPLETED' }),
    ),
  ).toBe(false);
  expect(modal).not.toHaveBeenCalled();
});
it('requires explicit host confirmation and allows cancellation', async () => {
  const state = importState({ status: 'COMPLETED' });
  modal.mockResolvedValueOnce('cancel');
  expect(await confirmImportStart(state)).toBe(false);
  modal.mockResolvedValueOnce('confirm');
  expect(await confirmImportStart(state)).toBe(true);
  expect(modal).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'Iniciar importação real?',
      confirmButtonText: 'Criar os dados no Twenty',
    }),
  );
});
