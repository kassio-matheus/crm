import { randomUUID } from 'node:crypto';
import { afterAll, expect, it } from 'vitest';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { RecordImporter } from 'src/services/record-importer';
import { ImportPreviewLedger } from 'src/services/import-preview-ledger';
import { sourceId } from 'src/utils/source-id.util';
const core = new CoreApiClient(),
  metadata = new MetadataApiClient();
const account = `test-view-cleanup-${randomUUID()}`,
  run = randomUUID();
const ledger = new ImportPreviewLedger(run, account, core),
  importer = new RecordImporter(ledger.client());
const pipelineId = sourceId(`${account}:pipelines:sample`),
  existingId = sourceId(`${account}:pipelines:existing`),
  aliasId = randomUUID();
afterAll(async () => {
  await core.mutation({
    destroySalesStage: {
      __args: { id: sourceId(`${account}:stages:stage`) },
      id: true,
    },
  });
  for (const id of [pipelineId, existingId])
    await core.mutation({ destroySalesPipeline: { __args: { id }, id: true } });
  const views = await metadata.query({ getViews: { id: true } });
  for (const id of [pipelineId, existingId, aliasId])
    if (views.getViews.some((v) => v.id === id))
      await metadata.mutation({ deleteView: { __args: { id } } });
  for (const prefix of [
    `${account}:`,
    `preview:${run}:`,
    `preview-view:${run}:`,
  ]) {
    const records = await core.query({
      rdSourceRecords: {
        __args: { first: 100, filter: { sourceKey: { startsWith: prefix } } },
        edges: { node: { id: true } },
      },
    });
    for (const { node } of records.rdSourceRecords!.edges)
      await core.mutation({
        destroyRdSourceRecord: { __args: { id: node.id }, id: true },
      });
  }
});
it('removes only sample-owned native pipeline views and recreates them on sample restore', async () => {
  await new RecordImporter(core).import(
    'pipelines',
    { id: 'existing', name: 'Existing fixture pipeline' },
    account,
    'old',
    false,
  );
  await importer.import(
    'pipelines',
    { id: 'sample', name: 'Sample fixture pipeline' },
    account,
    run,
    false,
  );
  await importer.import(
    'stages',
    { id: 'stage', name: 'Stage fixture', pipeline_id: 'sample', order: 0 },
    account,
    run,
    false,
  );
  const before = await metadata.query({
    getView: {
      __args: { id: pipelineId },
      objectMetadataId: true,
      viewFields: { id: true },
      viewGroups: { id: true, fieldValue: true, isVisible: true },
    },
  });
  await metadata.mutation({
    createView: {
      __args: {
        input: {
          id: aliasId,
          name: 'Unrelated user view',
          icon: 'IconList',
          type: 'TABLE',
          objectMetadataId: before.getView!.objectMetadataId,
        },
      },
      id: true,
    },
  });
  expect(await ledger.cleanup(async () => {})).toBe(1);
  const removed = await metadata.query({ getViews: { id: true } });
  expect(removed.getViews.some((v) => v.id === pipelineId)).toBe(false);
  expect(removed.getViews.some((v) => v.id === aliasId)).toBe(true);
  expect(removed.getViews.some((v) => v.id === existingId)).toBe(true);
  await ledger.restore();
  const restored = await metadata.query({
    getView: {
      __args: { id: pipelineId },
      viewFields: { id: true },
      viewGroups: { id: true, fieldValue: true, isVisible: true },
    },
  });
  expect(restored.getView!.viewFields.map((f) => f.id).sort()).toEqual(
    before.getView!.viewFields.map((f) => f.id).sort(),
  );
  expect(restored.getView!.viewGroups.filter((g) => g.isVisible)).toEqual(
    before.getView!.viewGroups.filter((g) => g.isVisible),
  );
  expect(
    restored
      .getView!.viewGroups.filter((g) => !g.fieldValue)
      .every((g) => !g.isVisible),
  ).toBe(true);
}, 300_000);
