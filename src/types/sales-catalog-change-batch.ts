export type SalesCatalogChangeBatch = {
  events: Array<{
    recordId: string;
    properties: {
      before?: { salesPipelineId?: string | null };
      after?: { salesPipelineId?: string | null };
    };
  }>;
};
