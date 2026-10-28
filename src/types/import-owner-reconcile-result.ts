import type { ImportOwnerReconcileRecord } from './import-owner-reconcile-record';

export type ImportOwnerReconcileResult = {
  completed: boolean;
  requests: number;
  assigned: number;
  preserved: number;
  unresolved: number;
  error?: string;
  results: (ImportOwnerReconcileRecord & {
    status: 'ASSIGNED' | 'PRESERVED' | 'UNRESOLVED';
    sourceOwnerId?: string;
    memberId?: string;
  })[];
};
