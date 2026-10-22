export type SalesChangeBatch = {
  events: Array<{
    recordId: string;
    properties: {
      before?: { targetOpportunityId?: string | null };
      after?: { targetOpportunityId?: string | null };
      updatedFields?: string[];
    };
  }>;
};
