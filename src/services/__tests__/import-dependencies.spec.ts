import { sourceId } from 'src/utils/source-id.util';
import { expect, it, vi } from 'vitest';
import type { CoreApiClient } from 'twenty-client-sdk/core';
import type { RecordImporter } from '../record-importer';
import type { PacedRdReader } from '../paced-rd-reader';
import { ImportDependencies } from '../import-dependencies';
import { importState } from 'src/__tests__/fixtures/import-state';
const setup = () => {
  const list = vi
    .fn()
    .mockResolvedValue({ records: [{ id: 'org', name: 'Related company' }] });
  const run = vi.fn().mockResolvedValue('created');
  const query = vi.fn().mockResolvedValue({ rdSourceRecords: { edges: [] } });
  const state = importState({
    dryRun: false,
    counts: {},
    processed: 0,
    created: 0,
    skipped: 0,
  });
  return {
    list,
    run,
    query,
    state,
    service: new ImportDependencies(
      { list } as unknown as PacedRdReader,
      { import: run } as unknown as RecordImporter,
      state,
      { query } as unknown as CoreApiClient,
    ),
  };
};
it('hydrates an older company by ID before importing its recent deal', async () => {
  const test = setup();
  await test.service.ensure('deals', { organization_id: 'org' });
  expect(test.list).toHaveBeenCalledWith('organizations/org', 1, null, true);
  expect(test.run).toHaveBeenCalledWith(
    'organizations',
    expect.objectContaining({ id: 'org' }),
    test.state.accountKey,
    test.state.id,
    false,
  );
  expect(test.state.counts.organizations).toBe(1);
});
it('preserves an existing imported dependency without another RD request', async () => {
  const test = setup();
  test.query.mockResolvedValue({
    rdSourceRecords: { edges: [{ node: { targetId: 'existing' } }] },
  });
  await test.service.ensure('deals', { organization_id: 'org' });
  expect(test.list).not.toHaveBeenCalled();
  expect(test.run).not.toHaveBeenCalled();
});
it('fails a mismatched detail response before creating a wrong relationship', async () => {
  const test = setup();
  test.list.mockResolvedValue({ records: [{ id: 'wrong' }] });
  await expect(
    test.service.ensure('deals', { organization_id: 'org' }),
  ).rejects.toThrow('RD_REFERENCE_MISMATCH');
  expect(test.run).not.toHaveBeenCalled();
});
it('deduplicates validated dependencies across sample pages without writing business records', async () => {
  const test = setup();
  test.state.dryRun = true;
  test.state.selection = {
    scope: 'sample',
    limit: 25,
    cutoff: '2026-10-24T00:00:00Z',
    selectedDeals: [],
  };
  await test.service.ensure('deals', { organization_id: 'org' });
  await test.service.ensure('deals', { organization_id: 'org' });
  expect(test.list).toHaveBeenCalledTimes(1);
  expect(test.run.mock.calls[0][4]).toBe(true);
  expect(test.state.selection.dependencyKeys).toHaveLength(1);
});

it('replays an existing linked company to fill its empty owner without another RD request', async () => {
  const test = setup();
  const source = { id: 'org', owner_id: 'owner' };
  test.query.mockResolvedValue({
    rdSourceRecords: {
      edges: [
        {
          node: {
            targetId: sourceId(`${test.state.accountKey}:organizations:org`),
            sourcePayload: source,
          },
        },
      ],
    },
  });
  await test.service.ensure('deals', { organization_id: 'org' });
  await test.service.ensure('deals', { organization_id: 'org' });
  expect(test.list).not.toHaveBeenCalled();
  expect(test.run).toHaveBeenCalledTimes(1);
  expect(test.run).toHaveBeenCalledWith(
    'organizations',
    source,
    test.state.accountKey,
    test.state.id,
    false,
  );
});
