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
    expect(mutation).toHaveBeenCalledTimes(9);
  });
  it('preserves native view customizations on replay', async () => {
    query
      .mockResolvedValueOnce({
        objects: {
          edges: [{ node: { id: 'opportunity', fieldsList: fields } }],
        },
      })
      .mockResolvedValueOnce({ getViews: [{ id: 'pipeline' }] })
      .mockResolvedValueOnce({
        getViewFields: fields.map((f) => ({ fieldMetadataId: f.id })),
        getViewFilters: [{ fieldMetadataId: 'salesPipeline' }],
        getViewSorts: [{ fieldMetadataId: 'name' }],
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
