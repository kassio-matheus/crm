import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import type { PreviewViewSnapshot } from 'src/types/preview-view-snapshot';
import type { PreviewOwnedRecord } from 'src/types/preview-owned-record';
import { sourceId } from 'src/utils/source-id.util';

type Receipt = {
  pipelineId: string;
  removed: boolean;
  snapshot: PreviewViewSnapshot | null;
};
/** Own only canonical boards of new sample pipelines. Alias/user views are never selected by name. */
export class ImportPreviewViews {
  constructor(
    private runId: string,
    private account: string,
    private core = new CoreApiClient(),
    private metadata = new MetadataApiClient(),
  ) {}
  private key(id: string) {
    return `preview-view:${this.runId}:${id}`;
  }
  private async read(id: string): Promise<Receipt | null> {
    const result = await this.core.query({
      rdSourceRecords: {
        __args: { first: 1, filter: { id: { eq: sourceId(this.key(id)) } } },
        edges: { node: { sourceKey: true, sourcePayload: true } },
      },
    });
    const row = result.rdSourceRecords!.edges[0]?.node;
    if (!row) return null;
    const receipt = row.sourcePayload as Receipt;
    if (
      row.sourceKey !== this.key(id) ||
      receipt?.pipelineId !== id ||
      (receipt.snapshot && receipt.snapshot.view.id !== id)
    )
      throw new Error('RD_INVALID_PREVIEW_VIEW_RECEIPT');
    return receipt;
  }
  private async save(receipt: Receipt, create = false) {
    const key = this.key(receipt.pipelineId);
    if (create)
      await this.core.mutation({
        createRdSourceRecord: {
          __args: {
            data: {
              id: sourceId(key),
              sourceKey: key,
              recordKind: 'previewViewOwnership',
              importRunId: this.runId,
              name: 'Sample pipeline view ownership',
              sourcePayload: receipt,
            },
          },
          id: true,
        },
      });
    else
      await this.core.mutation({
        updateRdSourceRecord: {
          __args: { id: sourceId(key), data: { sourcePayload: receipt } },
          id: true,
        },
      });
  }
  private async view(id: string) {
    const response = await this.metadata.query({
      getView: {
        __args: { id },
        id: true,
        objectMetadataId: true,
        name: true,
        icon: true,
        type: true,
        position: true,
        visibility: true,
        isCompact: true,
        shouldHideEmptyGroups: true,
        mainGroupByFieldMetadataId: true,
        kanbanAggregateOperation: true,
        kanbanAggregateOperationFieldMetadataId: true,
        kanbanColumnWidth: true,
        groupLoadLimit: true,
        anyFieldFilterValue: true,
        viewFields: {
          id: true,
          viewId: true,
          fieldMetadataId: true,
          isVisible: true,
          position: true,
          size: true,
          aggregateOperation: true,
          viewFieldGroupId: true,
        },
        viewFieldGroups: {
          id: true,
          viewId: true,
          name: true,
          position: true,
          isVisible: true,
        },
        viewFilters: {
          id: true,
          viewId: true,
          fieldMetadataId: true,
          operand: true,
          value: true,
          viewFilterGroupId: true,
          positionInViewFilterGroup: true,
          subFieldName: true,
          relationTargetFieldMetadataId: true,
        },
        viewFilterGroups: {
          id: true,
          viewId: true,
          logicalOperator: true,
          parentViewFilterGroupId: true,
          positionInViewFilterGroup: true,
        },
        viewGroups: {
          id: true,
          viewId: true,
          fieldValue: true,
          position: true,
          isVisible: true,
        },
        viewSorts: {
          id: true,
          viewId: true,
          fieldMetadataId: true,
          direction: true,
          subFieldName: true,
        },
      },
    });
    return response.getView ?? null;
  }
  async claim(pipelineId: string) {
    if ((await this.read(pipelineId)) || (await this.view(pipelineId))) return;
    await this.save({ pipelineId, removed: false, snapshot: null }, true);
  }
  private validatePipeline(owned: PreviewOwnedRecord) {
    if (
      owned.table !== 'salesPipelines' ||
      typeof owned.key !== 'string' ||
      !owned.key.startsWith(`${this.account}:pipelines:`) ||
      sourceId(owned.key) !== owned.id
    )
      throw new Error('RD_INVALID_PREVIEW_PIPELINE');
  }
  private managed(
    view: NonNullable<Awaited<ReturnType<ImportPreviewViews['view']>>>,
    pipelineId: string,
  ) {
    const filter = view.viewFilters.find(
      (item) => item.id === sourceId(`native-view-filter:${pipelineId}`),
    );
    let ids: unknown;
    try {
      ids =
        typeof filter?.value === 'string'
          ? JSON.parse(filter.value)
          : filter?.value;
    } catch {
      return false;
    }
    return (
      view.id === pipelineId &&
      view.type === 'KANBAN' &&
      view.icon === 'IconLock' &&
      Array.isArray(ids) &&
      ids.length === 1 &&
      ids[0] === pipelineId
    );
  }
  async prepare(pipelines: PreviewOwnedRecord[]) {
    for (const owned of pipelines) {
      this.validatePipeline(owned);
      const current = await this.view(owned.id);
      let receipt = await this.read(owned.id);
      if (!current) continue;
      // Legacy adoption requires both a proven sample pipeline receipt and the app's exact deterministic filter ID.
      if (!this.managed(current, owned.id)) {
        if (receipt)
          throw new Error(
            'RD_PREVIEW_VIEW_CHANGED: the sample view no longer has its original pipeline filter.',
          );
        continue;
      }
      const {
        viewFields,
        viewFieldGroups,
        viewFilters,
        viewFilterGroups,
        viewGroups,
        viewSorts,
        ...view
      } = current;
      const snapshot: PreviewViewSnapshot = {
        view,
        fields: viewFields,
        fieldGroups: viewFieldGroups,
        filters: viewFilters,
        filterGroups: viewFilterGroups,
        groups: viewGroups,
        sorts: viewSorts,
      };
      receipt = { pipelineId: owned.id, removed: false, snapshot };
      await this.save(receipt, !(await this.read(owned.id)));
    }
  }
  async cleanup(pipelines: PreviewOwnedRecord[]) {
    let count = 0;
    for (const owned of pipelines) {
      this.validatePipeline(owned);
      const receipt = await this.read(owned.id);
      if (!receipt?.snapshot) continue;
      const current = await this.view(owned.id);
      if (current && !this.managed(current, owned.id))
        throw new Error('RD_PREVIEW_VIEW_CHANGED');
      receipt.removed = true;
      await this.save(receipt);
      if (current)
        await this.metadata.mutation({
          deleteView: { __args: { id: owned.id } },
        });
      count += 1;
    }
    return count;
  }
  async restore(pipelines: PreviewOwnedRecord[]) {
    for (const owned of pipelines) {
      this.validatePipeline(owned);
      const receipt = await this.read(owned.id);
      if (!receipt?.removed || !receipt.snapshot) continue;
      const saved = receipt.snapshot;
      const current = await this.view(owned.id);
      if (current && !this.managed(current, owned.id))
        throw new Error('RD_PREVIEW_VIEW_CHANGED');
      if (!current)
        await this.metadata.mutation({
          createView: { __args: { input: saved.view }, id: true },
        });
      const present = (await this.view(owned.id))!;
      const create = async (
        operation: string,
        rows: { id?: string | null }[],
        existing: { id: string }[],
      ) => {
        for (const row of rows)
          if (!existing.some((item) => item.id === row.id))
            await this.metadata.mutation({
              [operation]: { __args: { input: row }, id: true },
            } as Parameters<MetadataApiClient['mutation']>[0]);
      };
      await create(
        'createViewFieldGroup',
        saved.fieldGroups,
        present.viewFieldGroups,
      );
      const pending = [...saved.filterGroups];
      const created = new Set(present.viewFilterGroups.map((item) => item.id));
      while (pending.length) {
        const index = pending.findIndex(
          (item) =>
            !item.parentViewFilterGroupId ||
            created.has(item.parentViewFilterGroupId),
        );
        if (index < 0) throw new Error('RD_INVALID_PREVIEW_VIEW_SNAPSHOT');
        const [group] = pending.splice(index, 1);
        await create(
          'createViewFilterGroup',
          [group],
          present.viewFilterGroups,
        );
        if (group.id) created.add(group.id);
      }
      await create('createViewField', saved.fields, present.viewFields);
      await create('createViewFilter', saved.filters, present.viewFilters);
      await create('createViewSort', saved.sorts, present.viewSorts);
      await create('createViewGroup', saved.groups, present.viewGroups);
      // Twenty may add a native unassigned placeholder when recreating a board.
      // Preserve the saved stage columns and keep every placeholder hidden.
      const final = await this.view(owned.id);
      for (const group of final?.viewGroups ?? [])
        if (!group.fieldValue && group.isVisible)
          await this.metadata.mutation({
            updateViewGroup: {
              __args: { input: { id: group.id, update: { isVisible: false } } },
              id: true,
            },
          });
      receipt.removed = false;
      await this.save(receipt);
    }
  }
}
