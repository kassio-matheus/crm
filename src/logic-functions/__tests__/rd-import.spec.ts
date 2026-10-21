import { describe, expect, it, vi } from 'vitest';
const control = vi.hoisted(() => vi.fn().mockResolvedValue(null));
vi.mock('src/services/import-coordinator', () => ({ ImportCoordinator: class { control = control; } }));
import definition from '../rd-import';
const context = { retryCount: 0, maxRetries: 0, workspaceId: 'workspace', userWorkspaceId: null, workspaceMemberId: null };
describe('rd-import handler', () => {
  it('rejects unknown actions', async () => { await expect(definition.config.handler({ action: 'destroy' }, context)).rejects.toThrow('Invalid import action'); expect(control).not.toHaveBeenCalled(); });
  it('delegates valid actions', async () => { await definition.config.handler({ action: 'status' }, context); expect(control).toHaveBeenCalledWith('status'); });
});
