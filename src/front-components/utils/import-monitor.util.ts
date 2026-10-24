import type { ImportState } from 'src/types/import-state';
import type { ImportMonitorSnapshot } from 'src/types/import-monitor-snapshot';

type Action = NonNullable<ImportMonitorSnapshot['pendingAction']>;
/** Single-flight polling of Twenty only. Commands are never retried automatically. */
export class ImportMonitor {
  static initial(): ImportMonitorSnapshot {
    return {
      state: null,
      loading: true,
      refreshing: false,
      error: '',
      lastSyncedAt: null,
      nextPollAt: null,
      failures: 0,
      pendingAction: null,
      recordsPerMinute: null,
      requestsPerMinute: null,
    };
  }
  private snapshot = ImportMonitor.initial();
  private active = false;
  private inFlight = false;
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private commandAt = 0;
  private commandRevision = -1;
  private samples: {
    at: number;
    processed: number;
    requests: number;
    dryRun: boolean;
  }[] = [];
  constructor(
    private execute: (action: 'status' | Action) => Promise<ImportState | null>,
    private changed: (snapshot: ImportMonitorSnapshot) => void,
    private now = Date.now,
  ) {}
  private emit() {
    if (this.active) this.changed({ ...this.snapshot });
  }
  start() {
    this.active = true;
    void this.refresh();
  }
  stop() {
    this.active = false;
    this.generation += 1;
    clearTimeout(this.timer);
  }
  private schedule() {
    clearTimeout(this.timer);
    if (!this.active) return;
    const running = ['READY', 'RUNNING'].includes(
      this.snapshot.state?.status ?? '',
    );
    const delay = this.snapshot.failures
      ? Math.min(20_000, 3_000 * 2 ** Math.min(3, this.snapshot.failures - 1))
      : this.snapshot.pendingAction
        ? 1_000
        : running
          ? 3_000
          : 15_000;
    this.snapshot.nextPollAt = this.now() + delay;
    this.timer = setTimeout(() => void this.refresh(), delay);
  }
  async refresh(): Promise<void> {
    if (!this.active || this.inFlight) return;
    clearTimeout(this.timer);
    this.inFlight = true;
    const generation = this.generation;
    this.snapshot.refreshing = true;
    this.emit();
    try {
      const state = await this.execute('status');
      if (!this.active || generation !== this.generation) return;
      const now = this.now();
      const pending = this.snapshot.pendingAction;
      this.snapshot = {
        ...this.snapshot,
        state,
        error: '',
        failures: 0,
        lastSyncedAt: now,
        loading: false,
      };
      if (state) {
        const previous = this.samples[this.samples.length - 1];
        if (
          previous &&
          (state.processed < previous.processed ||
            state.dryRun !== previous.dryRun)
        )
          this.samples = [];
        this.samples = [
          ...this.samples.filter((sample) => sample.at >= now - 60_000),
          {
            at: now,
            processed: state.processed,
            requests: state.requests,
            dryRun: state.dryRun,
          },
        ];
        const first = this.samples[0];
        const elapsed = now - first.at;
        const measuring = state.status === 'RUNNING' && elapsed >= 10_000;
        this.snapshot.recordsPerMinute = measuring
          ? Math.max(
              0,
              ((state.processed - first.processed) * 60_000) / elapsed,
            )
          : null;
        this.snapshot.requestsPerMinute = measuring
          ? Math.max(0, ((state.requests - first.requests) * 60_000) / elapsed)
          : null;
        const advanced = state.revision !== this.commandRevision;
        const confirmed =
          pending === 'pause'
            ? ['PAUSED', 'COMPLETED', 'FAILED'].includes(state.status)
            : pending === 'start'
              ? !state.dryRun
              : ['RUNNING', 'READY', 'COMPLETED'].includes(state.status) ||
                (advanced && state.status === 'FAILED');
        if (pending && confirmed) this.snapshot.pendingAction = null;
      }
      if (
        pending &&
        this.snapshot.pendingAction &&
        now - this.commandAt >= 30_000
      ) {
        this.snapshot.pendingAction = null;
        this.snapshot.error =
          'A solicitação ainda não foi confirmada. Confira o status antes de tentar novamente.';
      }
    } catch {
      if (this.active && generation === this.generation) {
        this.snapshot.failures += 1;
        this.snapshot.loading = false;
        this.snapshot.error =
          'Não foi possível atualizar o painel. Os últimos dados foram preservados; tentaremos novamente automaticamente.';
      }
    } finally {
      this.inFlight = false;
      if (this.active) {
        this.snapshot.refreshing = false;
        this.schedule();
        this.emit();
      }
    }
  }
  async command(action: Action): Promise<boolean> {
    if (!this.active || this.snapshot.pendingAction) return false;
    const state = this.snapshot.state;
    if (action === 'start' && (!state?.dryRun || state.status !== 'COMPLETED'))
      return false;
    if (
      action === 'resume' &&
      (!state || !['FAILED', 'PAUSED'].includes(state.status))
    )
      return false;
    if (
      action === 'pause' &&
      (!state || !['RUNNING', 'READY'].includes(state.status))
    )
      return false;
    if (
      action === 'simulate' &&
      state &&
      (!state.dryRun || ['RUNNING', 'READY'].includes(state.status))
    )
      return false;
    this.generation += 1;
    clearTimeout(this.timer);
    this.snapshot.pendingAction = action;
    this.snapshot.error = '';
    this.commandAt = this.now();
    this.commandRevision = state?.revision ?? -1;
    this.emit();
    try {
      const next = await this.execute(action);
      if (!this.active) return true;
      if (!this.snapshot.state && next) this.snapshot.state = next;
      return true;
    } catch {
      if (this.active) {
        this.snapshot.pendingAction = null;
        this.snapshot.error =
          'Não foi possível confirmar a ação. Atualize o painel e confira o checkpoint antes de tentar novamente.';
      }
      return false;
    } finally {
      if (this.active) {
        this.schedule();
        this.emit();
      }
    }
  }
}
