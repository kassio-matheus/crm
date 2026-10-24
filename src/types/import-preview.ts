export type ImportPreview = {
  runId: string;
  status: 'AVAILABLE' | 'CLEANING' | 'REMOVED' | 'PROMOTED';
  owned: number;
  removed: number;
};
