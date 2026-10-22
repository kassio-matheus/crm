import { IMPORT_CONTROL } from 'src/constants/rd-identifiers';
import { executeAppFunction } from 'src/front-components/utils/execute-app-function.util';
import type { ImportState } from 'src/types/import-state';
export const executeImport = async (
  action: 'status' | 'simulate' | 'start' | 'pause' | 'resume',
): Promise<ImportState | null> =>
  (await executeAppFunction(IMPORT_CONTROL, { action })) as ImportState | null;
