export type NativeSalesFilters = {
  pipelineId: string;
  ownerId: string;
  status: 'ALL' | 'ONGOING' | 'WON' | 'LOST' | 'PAUSED' | 'NOT_PAUSED';
  sort: string;
  mode: 'board' | 'list';
};
