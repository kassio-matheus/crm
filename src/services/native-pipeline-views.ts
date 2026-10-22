import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { sourceId } from 'src/utils/source-id.util';

/** Create-only native views: one board per pipeline, including its empty ordered stages. */
export class NativePipelineViews {
  constructor(private metadata = new MetadataApiClient()) {}
  async ensure(pipelineId: string, name: string) {
    const objectResult = await this.metadata.query({
      objects: {
        __args: {
          filter: {
            universalIdentifier: {
              eq: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity
                .universalIdentifier,
            },
          },
          paging: { first: 1 },
        },
        edges: { node: { id: true, fieldsList: { id: true, name: true } } },
      },
    });
    const object = objectResult.objects.edges[0]?.node;
    if (!object) throw new Error('Missing native opportunity metadata.');
    const field = (name: string) => {
      const match = object.fieldsList?.find((f) => f.name === name);
      if (!match) throw new Error(`Missing native sales field ${name}.`);
      return match.id;
    };
    const views = await this.metadata.query({
      getViews: { __args: { objectMetadataId: object.id }, id: true },
    });
    if (!views.getViews.some((v) => v.id === pipelineId))
      await this.metadata.mutation({
        createView: {
          __args: {
            input: {
              id: pipelineId,
              name,
              objectMetadataId: object.id,
              type: 'KANBAN',
              icon: 'IconLayoutKanban',
              mainGroupByFieldMetadataId: field('salesStage'),
              kanbanAggregateOperation: 'SUM',
              kanbanAggregateOperationFieldMetadataId: field('amount'),
              kanbanColumnWidth: 290,
              shouldHideEmptyGroups: false,
            },
          },
          id: true,
        },
      });
    const current = await this.metadata.query({
      getViewFields: { __args: { viewId: pipelineId }, fieldMetadataId: true },
      getViewFilters: { __args: { viewId: pipelineId }, fieldMetadataId: true },
      getViewSorts: { __args: { viewId: pipelineId }, fieldMetadataId: true },
    });
    for (const [position, name] of [
      'name',
      'dealStatus',
      'company',
      'owner',
      'qualification',
      'amount',
    ].entries())
      if (!current.getViewFields.some((f) => f.fieldMetadataId === field(name)))
        await this.metadata.mutation({
          createViewField: {
            __args: {
              input: {
                id: sourceId(`native-view-field:${pipelineId}:${name}`),
                viewId: pipelineId,
                fieldMetadataId: field(name),
                position,
                isVisible: true,
                size: 180,
              },
            },
            id: true,
          },
        });
    if (
      !current.getViewFilters.some(
        (f) => f.fieldMetadataId === field('salesPipeline'),
      )
    )
      await this.metadata.mutation({
        createViewFilter: {
          __args: {
            input: {
              id: sourceId(`native-view-filter:${pipelineId}`),
              viewId: pipelineId,
              fieldMetadataId: field('salesPipeline'),
              operand: 'IS',
              // Twenty stores filter values as serialized JSON; the generated scalar is too narrow.
              value: JSON.stringify([pipelineId]) as unknown as Record<
                string,
                unknown
              >,
            },
          },
          id: true,
        },
      });
    if (!current.getViewSorts.length)
      await this.metadata.mutation({
        createViewSort: {
          __args: {
            input: {
              id: sourceId(`native-view-sort:${pipelineId}`),
              viewId: pipelineId,
              fieldMetadataId: field('rdCreatedAt'),
              direction: 'DESC',
            },
          },
          id: true,
        },
      });
  }
  async addStage(pipelineId: string, stageId: string, position: number) {
    const groups = await this.metadata.query({
      getViewGroups: { __args: { viewId: pipelineId }, fieldValue: true },
    });
    if (!groups.getViewGroups.some((g) => g.fieldValue === stageId))
      await this.metadata.mutation({
        createViewGroup: {
          __args: {
            input: {
              id: sourceId(`native-view-group:${pipelineId}:${stageId}`),
              viewId: pipelineId,
              fieldValue: stageId,
              position,
              isVisible: true,
            },
          },
          id: true,
        },
      });
  }
}
