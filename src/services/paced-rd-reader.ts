import type { RdClient } from 'src/rd-client/rd-client';
import type { ImportState } from 'src/types/import-state';
import type { RdListOptions } from 'src/types/rd-list-options';

/** Includes on-demand dependency reads in the same persisted account request budget. */
export class PacedRdReader {
  constructor(
    private rd: RdClient,
    private state: ImportState,
    private save: () => Promise<void>,
  ) {}
  async list(
    path: string,
    page = 1,
    next: string | null = null,
    single = false,
    options?: RdListOptions,
  ) {
    const delay = Math.max(0, this.state.nextRequestAt - Date.now());
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    this.state.requests += 1;
    this.state.nextRequestAt = Date.now() + 800;
    await this.save();
    return this.rd.list(path, page, next, single, options);
  }
}
