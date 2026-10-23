export type ImportActivity = {
  id: string;
  at: string;
  event: 'page' | 'paused' | 'resumed' | 'retry' | 'failed' | 'completed';
  kind?: string;
  page: number;
  processed: number;
  created: number;
  dryRun: boolean;
  batchSize?: number;
  durationMs?: number;
  retryAfterMs?: number;
};
