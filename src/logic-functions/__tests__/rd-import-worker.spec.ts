import { describe, expect, it, vi } from 'vitest';
const run = vi.hoisted(() => vi.fn());
vi.mock('src/services/import-worker', () => ({ ImportWorker: class { run = run; } }));
import definition from '../rd-import-worker';
describe('rd-import-worker handler', () => { it('passes only the checkpoint command to its worker', async () => { await definition.config.handler({ revision: 2 }, { retryCount: 0, maxRetries: 0, workspaceId: 'w', userWorkspaceId: null, workspaceMemberId: null }); expect(run).toHaveBeenCalledWith({ revision: 2 }); }); });
