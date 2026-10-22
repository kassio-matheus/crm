import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { NativePipelineViews } from '../native-pipeline-views';
const query = vi.fn(),
  mutation = vi.fn();
const service = new NativePipelineViews({
  query,
  mutation,
} as unknown as MetadataApiClient);
const fields = [
  'salesStage',
  'salesPipeline',
  'name',
  'dealStatus',
  'company',
  'owner',
  'qualification',
  'amount',
  'rdCreatedAt',
].map((name) => ({ name, id: name }));
beforeEach(() => {
  query.mockReset();
  mutation.mockReset();
  mutation.mockResolvedValue({});
});
describe('native pipeline view provisioning', () => {
  it('creates native kanban fields and a pipeline filter without changing existing CRM records', async () => {
    query
      .mockResolvedValueOnce({
        objects: {
          edges: [{ node: { id: 'opportunity', fieldsList: fields } }],
        },
      })
      .mockResolvedValueOnce({ getViews: [] })
      .mockResolvedValueOnce({
        getViewFields: [],
        getViewFilters: [],
        getViewSorts: [],
      });
    await service.ensure('pipeline', 'Vendas');
    expect(mutation.mock.calls[0][0]).toMatchObject({
      createView: {
        __args: {
          input: {
            id: 'pipeline',
            type: 'KANBAN',
            name: 'Vendas',
            icon: 'IconLock',
            mainGroupByFieldMetadataId: 'salesStage',
            shouldHideEmptyGroups: false,
          },
        },
      },
    });
    expect(mutation.mock.calls.some(([r]) => r.createViewFilter)).toBe(true);
    expect(mutation).toHaveBeenCalledTimes(10);
  });
  it('preserves native view customizations on replay', async () => {
    query
      .mockResolvedValueOnce({
        objects: {
          edges: [{ node: { id: 'opportunity', fieldsList: fields } }],
        },
      })
      .mockResolvedValueOnce({
        getViews: [
          {
            id: 'pipeline',
            type: 'KANBAN',
            name: 'Old source name',
            icon: 'IconLock',
            mainGroupByFieldMetadataId: 'salesStage',
            shouldHideEmptyGroups: false,
          },
        ],
      })
      .mockResolvedValueOnce({
        getViewFields: fields.map((f) => ({ fieldMetadataId: f.id })),
        getViewFilters: [{ fieldMetadataId: 'salesPipeline' }],
        getViewSorts: [{ fieldMetadataId: 'name' }],
        getViewGroups: [{ id: 'null', fieldValue: '', isVisible: false }],
      });
    await service.ensure('pipeline', 'Old source name');
    expect(mutation).not.toHaveBeenCalled();
  });
  it('creates an ordered empty stage once', async () => {
    query.mockResolvedValueOnce({ getViewGroups: [] }).mockResolvedValueOnce({
      getViewGroups: [
        { id: 'g', fieldValue: 'stage', position: 2, isVisible: true },
      ],
    });
    await service.addStage('pipeline', 'stage', 2);
    await service.addStage('pipeline', 'stage', 2);
    expect(mutation).toHaveBeenCalledTimes(1);
    expect(mutation.mock.calls[0][0]).toMatchObject({
      createViewGroup: {
        __args: {
          input: { fieldValue: 'stage', position: 2, isVisible: true },
        },
      },
    });
  });
  it('stops when native opportunity metadata is absent', async () => {
    query.mockResolvedValue({ objects: { edges: [] } });
    await expect(service.ensure('p', 'Vendas')).rejects.toThrow('metadata');
    expect(mutation).not.toHaveBeenCalled();
  });
});

it('removes obsolete column metadata and reorders stages while keeping unassigned deals in the list', async () => {
  query.mockResolvedValueOnce({
    getViewGroups: [
      { id: 'a', fieldValue: 'stage-a', position: 8, isVisible: true },
      {
        id: 'wrong',
        fieldValue: 'other-pipeline-stage',
        position: 0,
        isVisible: true,
      },
      { id: 'null', fieldValue: '', position: -1, isVisible: true },
    ],
  });
  await service.syncStages('pipeline', [{ id: 'stage-a', order: 0 }]);
  expect(mutation.mock.calls.map(([r]) => r)).toEqual([
    {
      updateViewGroup: {
        __args: {
          input: { id: 'a', update: { position: 0, isVisible: true } },
        },
        id: true,
      },
    },
    { deleteViewGroup: { __args: { input: { id: 'wrong' } }, id: true } },
    {
      updateViewGroup: {
        __args: { input: { id: 'null', update: { isVisible: false } } },
        id: true,
      },
    },
  ]);
});

it('restores an existing hidden imported stage and applies its new position', async () => {
  query.mockResolvedValue({
    getViewGroups: [
      { id: 'g', fieldValue: 'stage', position: 9, isVisible: false },
    ],
  });
  await service.addStage('pipeline', 'stage', 1);
  expect(mutation.mock.calls[0][0]).toMatchObject({
    updateViewGroup: {
      __args: { input: { id: 'g', update: { position: 1, isVisible: true } } },
    },
  });
});

it('uses consecutive column positions even when source orders collide or have gaps', async () => {
  query.mockResolvedValueOnce({
    getViewGroups: [
      { id: 'a', fieldValue: 'stage-a', position: 9, isVisible: false },
      { id: 'b', fieldValue: 'stage-b', position: 9, isVisible: true },
      { id: 'null', fieldValue: '', position: -1, isVisible: false },
    ],
  });
  await service.syncStages('pipeline', [
    { id: 'stage-a', order: 9 },
    { id: 'stage-b', order: 9 },
  ]);
  expect(
    mutation.mock.calls.map(([r]) => r.updateViewGroup.__args.input.update),
  ).toEqual([
    { position: 0, isVisible: true },
    { position: 1, isVisible: true },
  ]);
});

it('keeps existing pipeline aliases in the native picker synchronized and ignores unrelated views', async () => {
  query
    .mockResolvedValueOnce({
      objects: { edges: [{ node: { id: 'opportunity', fieldsList: fields } }] },
    })
    .mockResolvedValueOnce({
      getViews: [
        {
          id: 'pipeline',
          name: 'Vendas',
          type: 'KANBAN',
          icon: 'IconLock',
          mainGroupByFieldMetadataId: 'salesStage',
          shouldHideEmptyGroups: false,
        },
        {
          id: 'alias',
          type: 'KANBAN',
          icon: 'IconLayoutKanban',
          mainGroupByFieldMetadataId: 'stage',
          shouldHideEmptyGroups: true,
          viewFilters: [
            {
              fieldMetadataId: 'salesPipeline',
              operand: 'IS',
              value: JSON.stringify({ selectedRecordIds: ['pipeline'] }),
            },
          ],
        },
        {
          id: 'other',
          type: 'KANBAN',
          viewFilters: [
            {
              fieldMetadataId: 'salesPipeline',
              operand: 'IS',
              value: '["another"]',
            },
          ],
        },
        {
          id: 'malformed',
          type: 'KANBAN',
          viewFilters: [
            {
              fieldMetadataId: 'salesPipeline',
              operand: 'IS',
              value: 'invalid JSON',
            },
          ],
        },
      ],
    })
    .mockResolvedValueOnce({
      getViewFields: fields.map((f) => ({ fieldMetadataId: f.id })),
      getViewFilters: [{ fieldMetadataId: 'salesPipeline' }],
      getViewSorts: [{ fieldMetadataId: 'name' }],
      getViewGroups: [{ id: 'null', fieldValue: '', isVisible: false }],
    });
  for (const id of ['canonical-group', 'alias-group'])
    query.mockResolvedValueOnce({
      getViewGroups: [
        { id, fieldValue: 'stage-a', position: 9, isVisible: false },
        { id: 'null', fieldValue: '', isVisible: false },
      ],
    });
  await service.ensure('pipeline', 'Vendas');
  await service.syncStages('pipeline', [{ id: 'stage-a', order: 5 }]);
  expect(mutation.mock.calls[0][0]).toMatchObject({
    updateView: {
      __args: {
        id: 'alias',
        input: {
          mainGroupByFieldMetadataId: 'salesStage',
          icon: 'IconLock',
          shouldHideEmptyGroups: false,
        },
      },
    },
  });
  expect(
    mutation.mock.calls
      .slice(1)
      .map(([r]) => r.updateViewGroup.__args.input.id),
  ).toEqual(['canonical-group', 'alias-group']);
});

it('accepts a column created concurrently but surfaces a failure when it is still absent', async () => {
  query
    .mockResolvedValueOnce({ getViewGroups: [] })
    .mockResolvedValueOnce({ getViewGroups: [{ fieldValue: 'stage' }] });
  mutation.mockRejectedValueOnce(new Error('duplicate group'));
  await service.addStage('pipeline', 'stage', 0);
  expect(mutation).toHaveBeenCalledTimes(1);
  query.mockResolvedValue({ getViewGroups: [] });
  mutation.mockRejectedValueOnce(new Error('permission denied'));
  await expect(service.addStage('pipeline', 'stage', 0)).rejects.toThrow(
    'permission denied',
  );
});

it('reuses a native field created by the queued pipeline event while import is provisioning', async () => {
  query
    .mockResolvedValueOnce({
      objects: { edges: [{ node: { id: 'opportunity', fieldsList: fields } }] },
    })
    .mockResolvedValueOnce({
      getViews: [
        {
          id: 'pipeline',
          name: 'Vendas',
          type: 'KANBAN',
          icon: 'IconLock',
          mainGroupByFieldMetadataId: 'salesStage',
          shouldHideEmptyGroups: false,
        },
      ],
    })
    .mockResolvedValueOnce({
      getViewFields: fields
        .filter((f) => f.name !== 'qualification')
        .map((f) => ({ fieldMetadataId: f.id })),
      getViewFilters: [{ fieldMetadataId: 'salesPipeline' }],
      getViewSorts: [{ fieldMetadataId: 'rdCreatedAt' }],
      getViewGroups: [{ id: 'null', fieldValue: '', isVisible: false }],
    })
    .mockResolvedValueOnce({
      getViewFields: [{ fieldMetadataId: 'qualification' }],
    });
  mutation.mockRejectedValueOnce(new Error('duplicate native field'));
  await service.ensure('pipeline', 'Vendas');
  expect(mutation).toHaveBeenCalledTimes(1);
});
