import { CoreApiClient } from 'twenty-client-sdk/core';

/** Maintains derived native sales fields; never changes original RD snapshots or commercial status. */
export class NativeSalesMaintenance {
  constructor(private client = new CoreApiClient({ runAs: 'application' })) {}

  async forTasks(taskIds: string[]) {
    const targets = new Set<string>();
    let cursor: string | null = null;
    if (!taskIds.length) return;
    do {
      const result: {
        taskTargets?: {
          edges: { node: { targetOpportunityId?: string | null } }[];
          pageInfo: { hasNextPage: boolean; endCursor?: string | null };
        };
      } = await this.client.query({
        taskTargets: {
          __args: {
            first: 100,
            after: cursor,
            filter: { taskId: { in: [...new Set(taskIds)] } },
          },
          edges: { node: { targetOpportunityId: true } },
          pageInfo: { hasNextPage: true, endCursor: true },
        },
      });
      for (const { node } of result.taskTargets!.edges)
        if (node.targetOpportunityId) targets.add(node.targetOpportunityId);
      const next: string | null = result.taskTargets!.pageInfo.hasNextPage
        ? (result.taskTargets!.pageInfo.endCursor ?? null)
        : null;
      if (next && next === cursor)
        throw new Error('Task target pagination did not advance.');
      cursor = next;
    } while (cursor);
    await this.refreshNextActivity([...targets]);
  }

  async refreshNextActivity(ids: string[]) {
    for (const id of new Set(ids)) {
      const opportunity = await this.client.query({
        opportunities: {
          __args: { first: 1, filter: { id: { eq: id } } },
          edges: { node: { id: true, nextActivityAt: true } },
        },
      });
      const existing = opportunity.opportunities!.edges[0]?.node;
      if (!existing) continue;
      let cursor: string | null = null;
      let earliest: string | null = null;
      do {
        const result: {
          taskTargets?: {
            edges: {
              node: {
                task?: {
                  dueAt?: string | null;
                  status?: string | null;
                  deletedAt?: string | null;
                } | null;
              };
            }[];
            pageInfo: { hasNextPage: boolean; endCursor?: string | null };
          };
        } = await this.client.query({
          taskTargets: {
            __args: {
              first: 100,
              after: cursor,
              filter: { targetOpportunityId: { eq: id } },
            },
            edges: {
              node: { task: { dueAt: true, status: true, deletedAt: true } },
            },
            pageInfo: { hasNextPage: true, endCursor: true },
          },
        });
        for (const { node } of result.taskTargets!.edges) {
          const task = node.task;
          if (
            !task?.dueAt ||
            task.deletedAt ||
            task.status === 'DONE' ||
            !Number.isFinite(Date.parse(task.dueAt))
          )
            continue;
          if (!earliest || Date.parse(task.dueAt) < Date.parse(earliest))
            earliest = task.dueAt;
        }
        const next: string | null = result.taskTargets!.pageInfo.hasNextPage
          ? (result.taskTargets!.pageInfo.endCursor ?? null)
          : null;
        if (next && next === cursor)
          throw new Error('Task pagination did not advance.');
        cursor = next;
      } while (cursor);
      if ((existing.nextActivityAt ?? null) !== earliest)
        await this.client.mutation({
          updateOpportunity: {
            __args: { id, data: { nextActivityAt: earliest } },
            id: true,
          },
        });
    }
  }

  async syncPipeline(id: string, stageChanged: boolean) {
    const result = await this.client.query({
      opportunities: {
        __args: { first: 1, filter: { id: { eq: id } } },
        edges: {
          node: {
            id: true,
            salesPipelineId: true,
            salesStageId: true,
            salesStage: { salesPipelineId: true },
          },
        },
      },
    });
    const deal = result.opportunities!.edges[0]?.node;
    if (
      !deal?.salesStageId ||
      !deal.salesStage?.salesPipelineId ||
      deal.salesPipelineId === deal.salesStage.salesPipelineId
    )
      return;
    await this.client.mutation({
      updateOpportunity: {
        __args: {
          id,
          data: stageChanged
            ? { salesPipelineId: deal.salesStage.salesPipelineId }
            : { salesStageId: null },
        },
        id: true,
      },
    });
  }
}
