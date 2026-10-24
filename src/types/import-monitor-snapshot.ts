import type { ImportState } from 'src/types/import-state';
export type ImportMonitorSnapshot = {
  state: ImportState | null;
  loading: boolean;
  refreshing: boolean;
  error: string;
  lastSyncedAt: number | null;
  nextPollAt: number | null;
  failures: number;
  pendingAction: 'simulate' | 'start' | 'pause' | 'resume' | null;
  recordsPerMinute: number | null;
  requestsPerMinute: number | null;
};
