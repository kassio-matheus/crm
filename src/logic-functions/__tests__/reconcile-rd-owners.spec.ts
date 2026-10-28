import { expect, it, vi } from 'vitest';
const run = vi.hoisted(() => vi.fn().mockResolvedValue({ completed: true }));
vi.mock('src/services/import-owner-reconciler', () => ({
  ImportOwnerReconciler: class {
    run = run;
  },
}));
import definition from '../reconcile-rd-owners';
it('delegates a bulk owner-only repair to its authorized service', async () => {
  const payload = { records: [{ id: 'native', kind: 'deals' }] };
  await definition.config.handler(payload, {
    retryCount: 0,
    maxRetries: 0,
    workspaceId: 'workspace',
    userWorkspaceId: null,
    workspaceMemberId: null,
  });
  expect(run).toHaveBeenCalledWith(payload);
});
