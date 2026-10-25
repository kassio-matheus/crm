import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { sourceId } from 'src/utils/source-id.util';

/** Managed native views: one board per pipeline, including its empty ordered stages. */
export class NativePipelineViews {
  private relatedBoards: string[] = [];
  constructor(private metadata = new MetadataApiClient()) {}
  async ensure(pipelineId: string, name: string) {
    const objectResult = await this.metadata.query({
      objects: {
        __args: {
          filter: {
            universalIdentifier: {
              // Define-time SDK exports are stubbed in deployed function bundles.
              eq: '20202020-9549-49dd-b2b2-883999db8938',
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
      getViews: {
        __args: { objectMetadataId: object.id },
        id: true,
        name: true,
        icon: true,
        type: true,
        mainGroupByFieldMetadataId: true,
        shouldHideEmptyGroups: true,
        viewFilters: { fieldMetadataId: true, operand: true, value: true },
      },
    });
    // Existing aliases in the native picker must follow catalog changes too.
    // Otherwise selecting an older saved view still exposes stale columns.
    this.relatedBoards = [];
    for (const view of views.getViews) {
      if (view.id === pipelineId || view.type !== 'KANBAN') continue;
      const filter = view.viewFilters?.find(
        (f) =>
          f.fieldMetadataId === field('salesPipeline') && f.operand === 'IS',
      );
      let selected: unknown;
      try {
        const value =
          typeof filter?.value === 'string'
            ? JSON.parse(filter.value)
            : filter?.value;
        selected = Array.isArray(value) ? value : value?.selectedRecordIds;
      } catch {
        continue;
      }
      if (
        !Array.isArray(selected) ||
        selected.length !== 1 ||
        selected[0] !== pipelineId
      )
        continue;
      this.relatedBoards.push(view.id);
      if (
        view.mainGroupByFieldMetadataId !== field('salesStage') ||
        view.shouldHideEmptyGroups ||
        view.icon !== 'IconLock'
      )
        await this.metadata.mutation({
          updateView: {
            __args: {
              id: view.id,
              input: {
                mainGroupByFieldMetadataId: field('salesStage'),
                shouldHideEmptyGroups: false,
                icon: 'IconLock',
              },
            },
            id: true,
          },
        });
    }
    if (!views.getViews.some((v) => v.id === pipelineId))
      await this.createOnce(
        () =>
          this.metadata.mutation({
            createView: {
              __args: {
                input: {
                  id: pipelineId,
                  name,
                  objectMetadataId: object.id,
                  type: 'KANBAN',
                  // The pinned Twenty host protects managed boards with this native lock icon.
                  icon: 'IconLock',
                  mainGroupByFieldMetadataId: field('salesStage'),
                  kanbanAggregateOperation: 'SUM',
                  kanbanAggregateOperationFieldMetadataId: field('amount'),
                  kanbanColumnWidth: 290,
                  shouldHideEmptyGroups: false,
                  position: -30,
                },
              },
              id: true,
            },
          }),
        async () =>
          (
            await this.metadata.query({
              getViews: { __args: { objectMetadataId: object.id }, id: true },
            })
          ).getViews.some((v) => v.id === pipelineId),
      );
    else {
      const view = views.getViews.find((v) => v.id === pipelineId)!;
      if (
        view.type !== 'KANBAN' ||
        view.name !== name ||
        view.icon !== 'IconLock' ||
        view.mainGroupByFieldMetadataId !== field('salesStage') ||
        view.shouldHideEmptyGroups !== false
      )
        await this.metadata.mutation({
          updateView: {
            __args: {
              id: pipelineId,
              input: {
                type: 'KANBAN',
                name,
                icon: 'IconLock',
                mainGroupByFieldMetadataId: field('salesStage'),
                shouldHideEmptyGroups: false,
              },
            },
            id: true,
          },
        });
    }
    const current = await this.metadata.query({
      getViewFields: { __args: { viewId: pipelineId }, fieldMetadataId: true },
      getViewFilters: { __args: { viewId: pipelineId }, fieldMetadataId: true },
      getViewSorts: { __args: { viewId: pipelineId }, fieldMetadataId: true },
      getViewGroups: {
        __args: { viewId: pipelineId },
        id: true,
        fieldValue: true,
        isVisible: true,
      },
    });
    await this.hideUnassigned(pipelineId, current.getViewGroups ?? []);
    for (const [position, name] of [
      'name',
      'dealStatus',
      'company',
      'owner',
      'qualification',
      'amount',
    ].entries())
      if (!current.getViewFields.some((f) => f.fieldMetadataId === field(name)))
        await this.createOnce(
          () =>
            this.metadata.mutation({
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
            }),
          async () =>
            (
              await this.metadata.query({
                getViewFields: {
                  __args: { viewId: pipelineId },
                  fieldMetadataId: true,
                },
              })
            ).getViewFields.some((f) => f.fieldMetadataId === field(name)),
        );
    if (
      !current.getViewFilters.some(
        (f) => f.fieldMetadataId === field('salesPipeline'),
      )
    )
      await this.createOnce(
        () =>
          this.metadata.mutation({
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
          }),
        async () =>
          (
            await this.metadata.query({
              getViewFilters: {
                __args: { viewId: pipelineId },
                fieldMetadataId: true,
              },
            })
          ).getViewFilters.some(
            (f) => f.fieldMetadataId === field('salesPipeline'),
          ),
      );
    if (!current.getViewSorts.length)
      await this.createOnce(
        () =>
          this.metadata.mutation({
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
          }),
        async () =>
          (
            await this.metadata.query({
              getViewSorts: {
                __args: { viewId: pipelineId },
                fieldMetadataId: true,
              },
            })
          ).getViewSorts.some(
            (f) => f.fieldMetadataId === field('rdCreatedAt'),
          ),
      );
  }
  async addStage(pipelineId: string, stageId: string, position: number) {
    const groups = await this.metadata.query({
      getViewGroups: {
        __args: { viewId: pipelineId },
        id: true,
        fieldValue: true,
        position: true,
        isVisible: true,
      },
    });
    const existing = groups.getViewGroups.find((g) => g.fieldValue === stageId);
    if (existing && (existing.position !== position || !existing.isVisible))
      await this.metadata.mutation({
        updateViewGroup: {
          __args: {
            input: { id: existing.id, update: { position, isVisible: true } },
          },
          id: true,
        },
      });
    else if (!existing)
      await this.createOnce(
        () =>
          this.metadata.mutation({
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
          }),
        async () =>
          (
            await this.metadata.query({
              getViewGroups: {
                __args: { viewId: pipelineId },
                fieldValue: true,
              },
            })
          ).getViewGroups.some((g) => g.fieldValue === stageId),
      );
  }
  async syncStages(
    pipelineId: string,
    stages: { id: string; order: number }[],
  ) {
    for (const viewId of [pipelineId, ...this.relatedBoards])
      await this.syncBoardStages(viewId, stages);
  }
  private async syncBoardStages(
    pipelineId: string,
    stages: { id: string; order: number }[],
  ) {
    const current = await this.metadata.query({
      getViewGroups: {
        __args: { viewId: pipelineId },
        id: true,
        fieldValue: true,
        position: true,
        isVisible: true,
      },
    });
    for (const [position, stage] of stages.entries()) {
      const group = current.getViewGroups.find(
        (g) => g.fieldValue === stage.id,
      );
      if (!group) await this.addStage(pipelineId, stage.id, position);
      else if (group.position !== position || !group.isVisible)
        await this.metadata.mutation({
          updateViewGroup: {
            __args: {
              input: {
                id: group.id,
                update: { position, isVisible: true },
              },
            },
            id: true,
          },
        });
    }
    // Remove only obsolete column metadata. Records and stage catalogs are untouched.
    for (const group of current.getViewGroups)
      if (group.fieldValue && !stages.some((s) => s.id === group.fieldValue))
        await this.metadata.mutation({
          deleteViewGroup: { __args: { input: { id: group.id } }, id: true },
        });
    await this.hideUnassigned(pipelineId, current.getViewGroups);
  }
  /** Also covers boards opened directly through Twenty's native view picker after import. */
  private async hideUnassigned(
    pipelineId: string,
    groups: { id: string; fieldValue: string; isVisible: boolean }[],
  ) {
    // Only actual stages are board columns. Unassigned deals stay available in the native list.
    const unassigned = groups.filter((g) => !g.fieldValue);
    for (const group of unassigned)
      if (group.isVisible)
        await this.metadata.mutation({
          updateViewGroup: {
            __args: { input: { id: group.id, update: { isVisible: false } } },
            id: true,
          },
        });
    if (!unassigned.length)
      await this.createOnce(
        () =>
          this.metadata.mutation({
            createViewGroup: {
              __args: {
                input: {
                  id: sourceId(`native-view-unassigned:${pipelineId}`),
                  viewId: pipelineId,
                  fieldValue: '',
                  position: -1,
                  isVisible: false,
                },
              },
              id: true,
            },
          }),
        async () =>
          (
            await this.metadata.query({
              getViewGroups: {
                __args: { viewId: pipelineId },
                fieldValue: true,
              },
            })
          ).getViewGroups.some((g) => g.fieldValue === ''),
      );
  }
  /** A competing importer/selector/catalog event may have completed the same
   * deterministic creation. Only swallow an error after verifying that result. */
  private async createOnce(
    create: () => Promise<unknown>,
    exists: () => Promise<boolean>,
  ) {
    try {
      await create();
    } catch (error) {
      if (!(await exists())) throw error;
    }
  }
}
