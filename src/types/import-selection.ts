export type ImportSelection = {
  scope: 'sample' | 'all';
  limit: number;
  cutoff: string;
  upper?: string;
  boundary?: string;
  selectedDeals: string[];
  dependencyKeys?: string[];
};
