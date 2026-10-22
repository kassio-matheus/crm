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
    query
      .mockResolvedValueOnce({ getViewGroups: [] })
      .mockResolvedValueOnce({ getViewGroups: [{ fieldValue: 'stage' }] });
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
