import { randomUUID } from 'node:crypto';
import { afterAll, expect, it, vi } from 'vitest';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { ImportWorker } from 'src/services/import-worker';
import type { ImportCoordinator } from 'src/services/import-coordinator';
import { RecordImporter } from 'src/services/record-importer';
import { sourceId } from 'src/utils/source-id.util';
import { importState } from './fixtures/import-state';
import type { ImportTransition } from 'src/types/import-transition';
import type { ImportState } from 'src/types/import-state';

vi.mock('twenty-sdk/logic-function', () => ({
  kv: { get: async () => null, set: async () => {} },
  getJobs: async () => [],
  enqueueJobs: async () => [],
}));
const core = new CoreApiClient();
const previous = importState({
  id: randomUUID(),
  accountKey: `test-transition-${randomUUID()}`,
  status: 'COMPLETED',
  phase: 'done',
});
const key = `scope-transition:${previous.id}:${previous.revision}`;
const id = sourceId(key);
afterAll(async () => {
  await core.mutation({ destroyRdSourceRecord: { __args: { id }, id: true } });
});

it('allows one persisted scope proposal under a real unique constraint and initializes it without replaying progress', async () => {
  const candidates: ImportTransition[] = ['sample', 'start'].map((action) => ({
    action: action as 'sample' | 'start',
    previous,
    next: { ...previous, id: randomUUID(), revision: previous.revision + 1 },
  }));
  const result = await Promise.allSettled(
    candidates.map((proposal) =>
      core.mutation({
        createRdSourceRecord: {
          __args: {
            data: {
              id,
              sourceKey: key,
              recordKind: 'scopeTransition',
              name: 'Isolated scope race fixture',
              sourcePayload: proposal,
            },
          },
          id: true,
        },
      }),
    ),
  );
  expect(
    result.filter((attempt) => attempt.status === 'fulfilled'),
  ).toHaveLength(1);
  expect(
    result.filter((attempt) => attempt.status === 'rejected'),
  ).toHaveLength(1);
  const retained = await core.query({
    rdSourceRecords: {
      __args: { first: 1, filter: { id: { eq: id } } },
      edges: { node: { sourcePayload: true } },
    },
  });
  const transition = retained.rdSourceRecords!.edges[0].node
    .sourcePayload as ImportTransition;
  let current = structuredClone(previous);
  const save = vi.fn(async (state: ImportState) => {
    current = structuredClone(state);
  });
  const coordinator = {
    read: async () => structuredClone(current),
    save,
  } as unknown as ImportCoordinator;
  const worker = new ImportWorker(coordinator, new RecordImporter(core), core);
  await worker.run({ transitionId: id, runId: transition.next.id });
  expect(current.id).toBe(transition.next.id);
  expect(save).toHaveBeenCalledTimes(1);
  current.revision += 10;
  await worker.run({ transitionId: id, runId: transition.next.id });
  expect(save).toHaveBeenCalledTimes(1);
  expect(current.revision).toBe(transition.next.revision + 10);
});
