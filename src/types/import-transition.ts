import type { ImportState } from 'src/types/import-state';
import type { ImportAction } from 'src/types/import-action';
export type ImportTransition = {
  action: ImportAction;
  previous: ImportState;
  next: ImportState;
};
