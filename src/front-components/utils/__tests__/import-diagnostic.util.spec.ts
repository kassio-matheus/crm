import { expect, it } from 'vitest';
import { importDiagnostic } from '../import-diagnostic.util';
import type { ImportState } from 'src/types/import-state';
import { importState } from 'src/__tests__/fixtures/import-state';
it('explains the observed 10k list limit without inviting a futile retry', () => {
  const result = importDiagnostic(
    importState({
      status: 'FAILED',
      page: 401,
      counts: { organizations: 10000 },
      error: 'RD_HTTP_400. Check the token permissions for this resource.',
    }),
  );
  expect(result?.title).toBe('Limite de listagem atingido');
  expect(result?.canResume).toBe(false);
});
const nonLimitCases: Partial<ImportState>[] = [
  { page: 2, counts: { organizations: 10000 } },
  { page: 401, counts: { organizations: 25 } },
  { page: 401, resourceIndex: 7, counts: { products: 10000 } },
];
it.each(nonLimitCases)(
  'does not classify every HTTP 400 as a source window limit',
  (override) => {
    expect(
      importDiagnostic(importState({ ...override, error: 'RD_HTTP_400' }))
        ?.canResume,
    ).toBe(true);
  },
);
it('shows access and connectivity guidance without reflecting foreign messages', () => {
  expect(
    importDiagnostic(importState({ error: 'RD_HTTP_403 SECRET' }))?.title,
  ).toBe('Confira o acesso ao RD Station');
  expect(
    importDiagnostic(importState({ error: 'RD_CONNECTION_FAILED SECRET' }))
      ?.description,
  ).not.toContain('SECRET');
  expect(importDiagnostic(null)).toBeNull();
  expect(importDiagnostic(importState())).toBeNull();
});
