import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { NATIVE_SALES } from 'src/constants/native-sales';

export const loadSalesFilterOptions = async (
  client = new CoreApiClient(),
  metadata = new MetadataApiClient(),
) => {
  const views = await metadata.query({
    getViews: { id: true, universalIdentifier: true },
  });
  const resolveView = (identifier: string) => {
    const view = views.getViews.find(
      (v) => v.universalIdentifier === identifier,
    );
    if (!view)
      throw new Error('Native sales view is missing. Sync the app first.');
    return view.id;
  };
  const pipelines: { id: string; name: string }[] = [];
  let cursor: string | null = null;
  do {
    const result: {
      salesPipelines?: {
        edges: { node: { id: string; name?: string } }[];
        pageInfo: { hasNextPage: boolean; endCursor?: string | null };
      };
    } = await client.query({
      salesPipelines: {
        __args: {
          first: 100,
          after: cursor,
          orderBy: [{ name: 'AscNullsLast' }, { id: 'AscNullsLast' }],
        },
        edges: { node: { id: true, name: true } },
        pageInfo: { hasNextPage: true, endCursor: true },
      },
    });
    pipelines.push(
      ...result.salesPipelines!.edges.map((e) => ({
        id: e.node.id,
        name: e.node.name || 'Sem nome',
      })),
    );
    const next: string | null = result.salesPipelines!.pageInfo.hasNextPage
      ? (result.salesPipelines!.pageInfo.endCursor ?? null)
      : null;
    if (next === cursor && next)
      throw new Error('Pipeline pagination did not advance.');
    cursor = next;
  } while (cursor);
  const members: { id: string; name: string }[] = [];
  cursor = null;
  do {
    const result: {
      workspaceMembers?: {
        edges: {
          node: {
            id: string;
            name?: {
              firstName?: string | null;
              lastName?: string | null;
            } | null;
          };
        }[];
        pageInfo: { hasNextPage: boolean; endCursor?: string | null };
      };
    } = await client.query({
      workspaceMembers: {
        __args: { first: 100, after: cursor },
        edges: {
          node: { id: true, name: { firstName: true, lastName: true } },
        },
        pageInfo: { hasNextPage: true, endCursor: true },
      },
    });
    members.push(
      ...result.workspaceMembers!.edges.map((e) => ({
        id: e.node.id,
        name:
          [e.node.name?.firstName, e.node.name?.lastName]
            .filter(Boolean)
            .join(' ') || 'Sem nome',
      })),
    );
    const next: string | null = result.workspaceMembers!.pageInfo.hasNextPage
      ? (result.workspaceMembers!.pageInfo.endCursor ?? null)
      : null;
    if (next === cursor && next)
      throw new Error('Member pagination did not advance.');
    cursor = next;
  } while (cursor);
  return {
    pipelines,
    members,
    views: {
      board: resolveView(NATIVE_SALES.board),
      pipelineBoard: resolveView(NATIVE_SALES.pipelineBoard),
      list: resolveView(NATIVE_SALES.list),
      pipelineViews: Object.fromEntries(
        pipelines
          .filter((p) => views.getViews.some((v) => v.id === p.id))
          .map((p) => [p.id, p.id]),
      ),
    },
  };
};
