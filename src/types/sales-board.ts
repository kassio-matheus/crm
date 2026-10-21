import type { SalesDeal } from 'src/types/sales-deal';
export type SalesBoard = {
  deals: SalesDeal[];
  pipelines: { id: string; name: string }[];
  stages: { id: string; name: string; pipelineId: string; order: number }[];
  members: { id: string; name: string }[];
};
