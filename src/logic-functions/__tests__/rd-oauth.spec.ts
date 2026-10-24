import { beforeEach, describe, expect, it, vi } from 'vitest';
const methods = vi.hoisted(() => ({ status: vi.fn(), start: vi.fn(), configurationFingerprint: vi.fn() }));
vi.mock('src/services/rd-oauth-service', () => ({
  RdOAuthService: class {
    status = methods.status;
    start = methods.start;
    configurationFingerprint = methods.configurationFingerprint;
  },
}));
import definition from '../rd-oauth';
const context = {
  retryCount: 0,
  maxRetries: 0,
  workspaceId: 'workspace',
  userWorkspaceId: null,
  workspaceMemberId: null,
};
beforeEach(() => vi.clearAllMocks());
describe('authenticated RD OAuth control', () => {
  it('only exposes an authenticated internal Twenty route', () => {
    expect(definition.config.httpRouteTriggerSettings).toMatchObject({
      isAuthRequired: true,
      httpMethod: 'POST',
    });
  });
  it('rejects unknown commands without an OAuth operation', async () => {
    await expect(
      definition.config.handler({ action: 'import' }, context),
    ).rejects.toThrow('Invalid OAuth action');
    expect(methods.start).not.toHaveBeenCalled();
  });
  it('dispatches the protected internal snapshot without starting OAuth', async () => {
    await definition.config.handler({ body: { action: 'fingerprint' } }, context);
    expect(methods.configurationFingerprint).toHaveBeenCalledTimes(1);
    expect(methods.start).not.toHaveBeenCalled();
  });
  it('only prepares authorization on an explicit start', async () => {
    await definition.config.handler({ body: { action: 'start' } }, context);
    expect(methods.start).toHaveBeenCalledTimes(1);
  });
});
