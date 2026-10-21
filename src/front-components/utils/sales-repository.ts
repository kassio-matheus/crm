import { CoreApiClient, type CoreSchema } from 'twenty-client-sdk/core';
import type { SalesBoard } from 'src/types/sales-board';
import type { SalesDeal } from 'src/types/sales-deal';

type Connection<T> = {
  edges: { node: T }[];
  pageInfo: { hasNextPage: boolean; endCursor?: string | null };
};

export class SalesRepository {
  constructor(private client = new CoreApiClient()) {}

  async load(): Promise<SalesBoard> {
    const board: SalesBoard = {
      deals: [],
      pipelines: [],
      stages: [],
      members: [],
    };
    let cursor: string | null = null;
    do {
      const result: {
        opportunities?: Connection<Omit<SalesDeal, 'name'> & { name?: string }>;
      } = await this.client.query({
        opportunities: {
          __args: {
            first: 100,
            after: cursor as string | null,
            orderBy: [{ id: 'AscNullsLast' }],
          },
          pageInfo: { hasNextPage: true, endCursor: true },
          edges: {
            node: {
              id: true,
              name: true,
              stage: true,
              createdAt: true,
              updatedAt: true,
              rdCreatedAt: true,
              dealStatus: true,
              salesPipelineKey: true,
              salesStageKey: true,
              qualification: true,
              closeDate: true,
              nextActivityAt: true,
              lastContactAt: true,
              ownerId: true,
              rdOwnerName: true,
              rdOwnerId: true,
              rdOriginalData: true,
              amount: { amountMicros: true, currencyCode: true },
              company: { id: true, name: true },
              pointOfContact: {
                id: true,
                name: { firstName: true, lastName: true },
                emails: { primaryEmail: true },
                phones: { primaryPhoneNumber: true },
              },
              owner: { id: true, name: { firstName: true, lastName: true } },
            },
          },
        },
      });
      const connection = result.opportunities!;
      board.deals.push(
        ...connection.edges.map((e) => ({
          ...e.node,
          name: e.node.name || 'Sem nome',
        })),
      );
      const next: string | null = connection.pageInfo.hasNextPage
        ? (connection.pageInfo.endCursor ?? null)
        : null;
      if (next && next === cursor)
        throw new Error('A paginação de negociações não avançou.');
      cursor = next;
    } while (cursor);
    cursor = null;
    do {
      const result: {
        rdSourceRecords?: Connection<{
          sourceId?: string | null;
          recordKind?: string | null;
          name?: string;
          sourcePayload?: Record<string, unknown> | null;
          parentSourceId?: string | null;
        }>;
      } = await this.client.query({
        rdSourceRecords: {
          __args: {
            first: 100,
            after: cursor as string | null,
            filter: { recordKind: { in: ['pipelines', 'stages'] } },
            orderBy: [{ id: 'AscNullsLast' }],
          },
          pageInfo: { hasNextPage: true, endCursor: true },
          edges: {
            node: {
              sourceId: true,
              recordKind: true,
              name: true,
              sourcePayload: true,
              parentSourceId: true,
            },
          },
        },
      });
      const connection = result.rdSourceRecords!;
      for (const { node } of connection.edges) {
        const raw = node.sourcePayload as Record<string, unknown> | null;
        if (!node.sourceId) continue;
        if (node.recordKind === 'pipelines')
          board.pipelines.push({
            id: node.sourceId,
            name: node.name || 'Sem nome',
          });
        else
          board.stages.push({
            id: node.sourceId,
            name: node.name || 'Sem nome',
            pipelineId:
              node.parentSourceId ??
              String(raw?.pipeline_id ?? raw?.deal_pipeline_id ?? ''),
            order: Number(raw?.order ?? 0),
          });
      }
      const next: string | null = connection.pageInfo.hasNextPage
        ? (connection.pageInfo.endCursor ?? null)
        : null;
      if (next && next === cursor)
        throw new Error('A paginação de funis não avançou.');
      cursor = next;
    } while (cursor);
    cursor = null;
    do {
      const result: {
        workspaceMembers?: Connection<{
          id: string;
          name?: { firstName?: string | null; lastName?: string | null } | null;
        }>;
      } = await this.client.query({
        workspaceMembers: {
          __args: { first: 100, after: cursor },
          pageInfo: { hasNextPage: true, endCursor: true },
          edges: {
            node: { id: true, name: { firstName: true, lastName: true } },
          },
        },
      });
      const connection = result.workspaceMembers!;
      board.members.push(
        ...connection.edges.map(({ node }) => ({
          id: node.id,
          name: `${node.name?.firstName ?? ''} ${node.name?.lastName ?? ''}`.trim(),
        })),
      );
      cursor = connection.pageInfo.hasNextPage
        ? (connection.pageInfo.endCursor ?? null)
        : null;
    } while (cursor);
    // Fetch each pending task and relation once, avoiding one request per task.
    const deadlines = new Map<string, string>();
    const dealsById = new Map(board.deals.map((deal) => [deal.id, deal]));
    cursor = null;
    for (const deal of board.deals) deal.nextActivityAt = null;
    do {
      const result: {
        tasks?: Connection<{ id: string; dueAt?: string | null }>;
      } = await this.client.query({
        tasks: {
          __args: {
            first: 100,
            after: cursor as string | null,
            filter: { status: { neq: 'DONE' } },
          },
          pageInfo: { hasNextPage: true, endCursor: true },
          edges: { node: { id: true, dueAt: true } },
        },
      });
      const connection = result.tasks!;
      for (const { node: task } of connection.edges)
        if (task.dueAt) deadlines.set(task.id, task.dueAt);
      cursor = connection.pageInfo.hasNextPage
        ? (connection.pageInfo.endCursor ?? null)
        : null;
    } while (cursor);
    cursor = null;
    if (deadlines.size > 0)
      do {
        const result: {
          taskTargets?: Connection<{
            taskId?: string | null;
            targetOpportunityId?: string | null;
          }>;
        } = await this.client.query({
          taskTargets: {
            __args: { first: 100, after: cursor as string | null },
            pageInfo: { hasNextPage: true, endCursor: true },
            edges: { node: { taskId: true, targetOpportunityId: true } },
          },
        });
        const connection = result.taskTargets!;
        for (const { node } of connection.edges) {
          const dueAt = node.taskId ? deadlines.get(node.taskId) : undefined;
          const deal = node.targetOpportunityId
            ? dealsById.get(node.targetOpportunityId)
            : undefined;
          if (
            deal &&
            dueAt &&
            (!deal.nextActivityAt ||
              Date.parse(dueAt) < Date.parse(deal.nextActivityAt))
          )
            deal.nextActivityAt = dueAt;
        }
        cursor = connection.pageInfo.hasNextPage
          ? (connection.pageInfo.endCursor ?? null)
          : null;
      } while (cursor);
    board.stages.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    return board;
  }

  async update(
    id: string,
    data: CoreSchema.OpportunityUpdateInput,
  ): Promise<void> {
    await this.client.mutation({
      updateOpportunity: { __args: { id, data }, id: true },
    });
  }

  async create(
    name: string,
    pipelineId: string,
    stageId: string,
    ownerId: string | null,
  ): Promise<void> {
    if (!name.trim()) throw new Error('Informe o nome da negociação.');
    await this.client.mutation({
      createOpportunity: {
        __args: {
          data: {
            name: name.trim(),
            dealStatus: 'ONGOING',
            salesPipelineKey: pipelineId || null,
            salesStageKey: pipelineId ? stageId : null,
            stage: !pipelineId
              ? (stageId as CoreSchema.OpportunityStageEnum)
              : 'NEW',
            ownerId,
          },
        },
        id: true,
      },
    });
  }

  async createTask(
    dealId: string,
    title: string,
    dueAt: string,
    requestId: string,
  ): Promise<void> {
    if (!title.trim() || !Number.isFinite(Date.parse(dueAt)))
      throw new Error('Informe o título e uma data válida para a tarefa.');
    const existing = await this.client.query({
      tasks: {
        __args: { filter: { id: { eq: requestId } }, first: 1 },
        edges: { node: { id: true } },
      },
    });
    if (!existing.tasks!.edges.length)
      await this.client.mutation({
        createTask: {
          __args: {
            data: {
              id: requestId,
              title: title.trim(),
              dueAt: new Date(dueAt).toISOString(),
              status: 'TODO',
            },
          },
          id: true,
        },
      });
    const links = await this.client.query({
      taskTargets: {
        __args: {
          filter: {
            taskId: { eq: requestId },
            targetOpportunityId: { eq: dealId },
          },
          first: 1,
        },
        edges: { node: { id: true } },
      },
    });
    if (!links.taskTargets!.edges.length)
      await this.client.mutation({
        createTaskTarget: {
          __args: { data: { taskId: requestId, targetOpportunityId: dealId } },
          id: true,
        },
      });
  }
  async activities(deal: SalesDeal): Promise<{
    tasks: {
      id: string;
      title: string;
      status: string;
      dueAt?: string | null;
    }[];
    notes: { id: string; title: string; text: string; createdAt: string }[];
    source: { kind: string; data: Record<string, unknown> }[];
  }> {
    const result: {
      tasks: {
        id: string;
        title: string;
        status: string;
        dueAt?: string | null;
      }[];
      notes: { id: string; title: string; text: string; createdAt: string }[];
      source: { kind: string; data: Record<string, unknown> }[];
    } = { tasks: [], notes: [], source: [] };
    let cursor: string | null = null;
    do {
      const data: {
        taskTargets?: Connection<{
          task?: {
            id: string;
            title?: string;
            status?: string;
            dueAt?: string | null;
          } | null;
        }>;
      } = await this.client.query({
        taskTargets: {
          __args: {
            first: 100,
            after: cursor as string | null,
            filter: { targetOpportunityId: { eq: deal.id } },
          },
          pageInfo: { hasNextPage: true, endCursor: true },
          edges: {
            node: {
              task: { id: true, title: true, status: true, dueAt: true },
            },
          },
        },
      });
      result.tasks.push(
        ...data.taskTargets!.edges.flatMap((e) =>
          e.node.task
            ? [
                {
                  ...e.node.task,
                  title: e.node.task.title || 'Tarefa',
                  status: e.node.task.status || 'TODO',
                },
              ]
            : [],
        ),
      );
      cursor = data.taskTargets!.pageInfo.hasNextPage
        ? (data.taskTargets!.pageInfo.endCursor ?? null)
        : null;
    } while (cursor);
    cursor = null;
    do {
      const data: {
        noteTargets?: Connection<{
          note?: {
            id: string;
            title?: string;
            createdAt: string;
            bodyV2?: { markdown?: string | null } | null;
          } | null;
        }>;
      } = await this.client.query({
        noteTargets: {
          __args: {
            first: 100,
            after: cursor as string | null,
            filter: { targetOpportunityId: { eq: deal.id } },
          },
          pageInfo: { hasNextPage: true, endCursor: true },
          edges: {
            node: {
              note: {
                id: true,
                title: true,
                createdAt: true,
                bodyV2: { markdown: true },
              },
            },
          },
        },
      });
      result.notes.push(
        ...data.noteTargets!.edges.flatMap((e) =>
          e.node.note
            ? [
                {
                  id: e.node.note.id,
                  title: e.node.note.title || 'Anotação',
                  createdAt: e.node.note.createdAt,
                  text: e.node.note.bodyV2?.markdown ?? '',
                },
              ]
            : [],
        ),
      );
      cursor = data.noteTargets!.pageInfo.hasNextPage
        ? (data.noteTargets!.pageInfo.endCursor ?? null)
        : null;
    } while (cursor);
    const externalId = deal.rdOriginalData?.id ?? deal.rdOriginalData?._id;
    if (typeof externalId === 'string') {
      cursor = null;
      do {
        const data: {
          rdSourceRecords?: Connection<{
            recordKind?: string | null;
            sourcePayload?: Record<string, unknown> | null;
          }>;
        } = await this.client.query({
          rdSourceRecords: {
            __args: {
              first: 100,
              after: cursor as string | null,
              filter: { parentSourceId: { eq: externalId } },
            },
            pageInfo: { hasNextPage: true, endCursor: true },
            edges: { node: { recordKind: true, sourcePayload: true } },
          },
        });
        result.source.push(
          ...data.rdSourceRecords!.edges.map((e) => ({
            kind: e.node.recordKind ?? '',
            data: (e.node.sourcePayload as Record<string, unknown>) ?? {},
          })),
        );
        cursor = data.rdSourceRecords!.pageInfo.hasNextPage
          ? (data.rdSourceRecords!.pageInfo.endCursor ?? null)
          : null;
      } while (cursor);
    }
    return result;
  }

  async addNote(
    dealId: string,
    text: string,
    requestId: string,
  ): Promise<void> {
    if (!text.trim()) throw new Error('Escreva a anotação.');
    const existing = await this.client.query({
      notes: {
        __args: { first: 1, filter: { id: { eq: requestId } } },
        edges: { node: { id: true } },
      },
    });
    if (!existing.notes!.edges.length)
      await this.client.mutation({
        createNote: {
          __args: {
            data: {
              id: requestId,
              title: 'Anotação da negociação',
              bodyV2: { markdown: text.trim() },
            },
          },
          id: true,
        },
      });
    const link = await this.client.query({
      noteTargets: {
        __args: {
          first: 1,
          filter: {
            noteId: { eq: requestId },
            targetOpportunityId: { eq: dealId },
          },
        },
        edges: { node: { id: true } },
      },
    });
    if (!link.noteTargets!.edges.length)
      await this.client.mutation({
        createNoteTarget: {
          __args: { data: { noteId: requestId, targetOpportunityId: dealId } },
          id: true,
        },
      });
  }

  async completeTask(id: string): Promise<void> {
    await this.client.mutation({
      updateTask: { __args: { id, data: { status: 'DONE' } }, id: true },
    });
  }
}
