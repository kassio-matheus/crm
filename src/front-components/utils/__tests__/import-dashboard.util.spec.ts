import { expect, it } from 'vitest';
import { importDashboard } from '../import-dashboard.util';
import { importState } from 'src/__tests__/fixtures/import-state';
it('reports category progress rather than inventing total records or ETA', () => {
  const model = importDashboard(
    importState(),
    Date.parse('2026-10-23T18:02:00Z'),
  );
  expect(model.current).toBe('Empresas');
  expect(model.done).toBe(4);
  expect(model.total).toBe(16);
  expect(model.percent).toBe(25);
  expect(model.elapsedSeconds).toBe(120);
  expect(model).not.toHaveProperty('totalRecords');
  expect(model).not.toHaveProperty('eta');
});
it('handles paused legacy checkpoints with no telemetry', () => {
  const model = importDashboard(
    importState({ status: 'PAUSED' }),
    Date.parse('2026-10-23T20:00:00Z'),
  );
  expect(model.current).toBe('Empresas');
  expect(model.elapsedSeconds).toBe(60);
  expect(model.retrySeconds).toBe(0);
});
it('shows stage discovery in its actual phase and does not mark it complete early', () => {
  const model = importDashboard(
    importState({ phase: 'pipelineDetails', resourceIndex: 1 }),
    Date.now(),
  );
  expect(model.current).toBe('Etapas dos funis');
  expect(model.rows.find((row) => row.key === 'stages')?.status).toBe(
    'current',
  );
  expect(model.rows.find((row) => row.key === 'users')?.status).toBe('waiting');
});
it('shows completion and clamped retry waits without negative values', () => {
  expect(
    importDashboard(
      importState({ status: 'COMPLETED', phase: 'done' }),
      Date.now(),
    ).percent,
  ).toBe(100);
  expect(
    importDashboard(importState({ retryCount: 1, nextRequestAt: 1000 }), 2000)
      .retrySeconds,
  ).toBe(0);
  expect(
    importDashboard(importState({ retryCount: 1, nextRequestAt: 61_000 }), 1000)
      .retrySeconds,
  ).toBe(60);
});
it('has a useful empty state and supports the v1 resource order', () => {
  expect(importDashboard(null, Date.now()).done).toBe(0);
  expect(
    importDashboard(
      importState({ version: 'v1', resourceIndex: 10 }),
      Date.now(),
    ).current,
  ).toBe('Negociações');
});
