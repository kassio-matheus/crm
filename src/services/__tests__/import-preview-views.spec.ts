import { expect, it, vi } from 'vitest';
import type { CoreApiClient } from 'twenty-client-sdk/core';
import type { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { ImportPreviewViews } from '../import-preview-views';
import { sourceId } from 'src/utils/source-id.util';
import type { PreviewOwnedRecord } from 'src/types/preview-owned-record';
const pipeline = (): PreviewOwnedRecord => ({
  table: 'salesPipelines',
  key: 'a:pipelines:p',
  id: sourceId('a:pipelines:p'),
  deleted: false,
});
const managed = (id: string) => ({
  id,
  objectMetadataId: 'opportunity',
  type: 'KANBAN',
  icon: 'IconLock',
  name: 'Sales',
  position: 2,
  shouldHideEmptyGroups: false,
  viewFields: [
    {
      id: 'field',
      fieldMetadataId: 'name',
      viewId: id,
      isVisible: true,
      size: 200,
      position: 0,
    },
  ],
  viewFieldGroups: [],
  viewFilters: [
    {
      id: sourceId(`native-view-filter:${id}`),
      viewId: id,
      fieldMetadataId: 'salesPipeline',
      operand: 'IS',
      value: JSON.stringify([id]),
    },
  ],
  viewFilterGroups: [],
  viewGroups: [
    {
      id: 'stage',
      viewId: id,
      fieldValue: 'stage-id',
      position: 0,
      isVisible: true,
    },
  ],
  viewSorts: [],
});
const setup = () => {
  const receipts = new Map<string, any>(),
    views = new Map<string, any>();
  const query = vi.fn(async (r) => ({
    rdSourceRecords: {
      edges: receipts.has(r.rdSourceRecords.__args.filter.id.eq)
        ? [
            {
              node: structuredClone(
                receipts.get(r.rdSourceRecords.__args.filter.id.eq),
              ),
            },
          ]
        : [],
    },
  }));
  const mutation = vi.fn(async (r) => {
    if (r.createRdSourceRecord) {
      const d = r.createRdSourceRecord.__args.data;
      receipts.set(d.id, structuredClone(d));
    } else {
      const a = r.updateRdSourceRecord.__args;
      Object.assign(receipts.get(a.id), structuredClone(a.data));
    }
    return {};
  });
  const metadataQuery = vi.fn(async (r) => ({
    getView: structuredClone(views.get(r.getView.__args.id) ?? null),
  }));
  const metadataMutation = vi.fn(async (r) => {
    if (r.deleteView) views.delete(r.deleteView.__args.id);
    else if (r.createView) {
      const v = r.createView.__args.input;
      views.set(v.id, {
        ...v,
        viewFields: [],
        viewFieldGroups: [],
        viewFilters: [],
        viewFilterGroups: [],
        viewGroups: [],
        viewSorts: [],
      });
    } else {
      const op = Object.keys(r)[0];
      const row = r[op].__args.input;
      const table: Record<string, string> = {
        createViewField: 'viewFields',
        createViewFieldGroup: 'viewFieldGroups',
        createViewFilter: 'viewFilters',
        createViewFilterGroup: 'viewFilterGroups',
        createViewGroup: 'viewGroups',
        createViewSort: 'viewSorts',
      };
      views.get(row.viewId)[table[op]].push(structuredClone(row));
    }
    return {};
  });
  return {
    receipts,
    views,
    mutation,
    metadataMutation,
    service: new ImportPreviewViews(
      'run',
      'a',
      { query, mutation } as unknown as CoreApiClient,
      {
        query: metadataQuery,
        mutation: metadataMutation,
      } as unknown as MetadataApiClient,
    ),
  };
};
it('claims a missing canonical view before the pipeline can trigger metadata creation', async () => {
  const t = setup();
  await t.service.claim(pipeline().id);
  expect(t.receipts.size).toBe(1);
  expect(t.metadataMutation).not.toHaveBeenCalled();
  const receipt = [...t.receipts.values()][0];
  expect(receipt.sourcePayload).toMatchObject({
    pipelineId: pipeline().id,
    removed: false,
    snapshot: null,
  });
});
it('adopts only a proven legacy sample board, removes it and restores its exact fields and columns', async () => {
  const t = setup();
  const p = pipeline();
  const view = managed(p.id);
  t.views.set(p.id, structuredClone(view));
  t.views.set('user-alias', managed('user-alias'));
  await t.service.prepare([p]);
  await t.service.cleanup([p]);
  expect(t.views.has(p.id)).toBe(false);
  expect(t.views.has('user-alias')).toBe(true);
  await t.service.restore([p]);
  expect(t.views.get(p.id)).toEqual(view);
  await t.service.restore([p]);
  expect(t.views.get(p.id).viewFields).toHaveLength(1);
});
it('preserves an existing unrelated canonical-ID view instead of claiming it by name', async () => {
  const t = setup();
  const p = pipeline();
  const view = managed(p.id);
  view.viewFilters[0].value = '["other-pipeline"]';
  t.views.set(p.id, view);
  await t.service.claim(p.id);
  await t.service.prepare([p]);
  await t.service.cleanup([p]);
  expect(t.receipts.size).toBe(0);
  expect(t.metadataMutation).not.toHaveBeenCalled();
});
it('stops before deleting a claimed view whose pipeline filter was changed', async () => {
  const t = setup();
  const p = pipeline();
  await t.service.claim(p.id);
  const view = managed(p.id);
  view.viewFilters[0].value = '["other"]';
  t.views.set(p.id, view);
  await expect(t.service.prepare([p])).rejects.toThrow(
    'RD_PREVIEW_VIEW_CHANGED',
  );
  expect(t.metadataMutation).not.toHaveBeenCalled();
});
it('rejects a forged pipeline reference before reading metadata', async () => {
  const t = setup();
  await expect(
    t.service.prepare([{ ...pipeline(), id: 'arbitrary-view' }]),
  ).rejects.toThrow('RD_INVALID_PREVIEW_PIPELINE');
  expect(t.metadataMutation).not.toHaveBeenCalled();
});
