import { CoreApiClient } from 'twenty-client-sdk/core';
import { sourceId } from 'src/utils/source-id.util';
import { rdRecordDependencies } from 'src/utils/rd-record-dependencies.util';
import type { PacedRdReader } from 'src/services/paced-rd-reader';
import type { RecordImporter } from 'src/services/record-importer';
import type { ImportState } from 'src/types/import-state';

export class ImportDependencies {
  private verified = new Set<string>();
  constructor(
    private reader: PacedRdReader,
    private importer: RecordImporter,
    private state: ImportState,
    private core = new CoreApiClient(),
  ) {}
  async ensure(
    kind: string,
    record: Record<string, unknown>,
    depth = 0,
  ): Promise<void> {
    if (depth > 4) throw new Error('RD_CYCLIC_REFERENCE');
    for (const dependency of rdRecordDependencies(kind, record)) {
      const key = `${this.state.accountKey}:${dependency.kind}:${dependency.id}`;
      if (
        this.verified.has(key) ||
        (this.state.dryRun &&
          this.state.selection?.dependencyKeys?.includes(key))
      )
        continue;
      const existing = await this.core.query({
        rdSourceRecords: {
          __args: {
            first: 1,
            filter: { id: { eq: sourceId(`archive:${key}`) } },
          },
          edges: { node: { targetId: true } },
        },
      });
      const archived = existing.rdSourceRecords!.edges[0]?.node;
      if (
        !this.state.dryRun &&
        dependency.kind === 'organizations' &&
        archived?.targetId === sourceId(key)
      ) {
        // Read the current RD owner rather than assigning from an older snapshot.
        const response = await this.reader.list(
          `${dependency.kind}/${encodeURIComponent(dependency.id)}`,
          1,
          null,
          true,
        );
        const source = response.records[0];
        if (!source || (source.id ?? source._id) !== dependency.id)
          throw new Error('RD_REFERENCE_MISMATCH');
        await this.importer.import(
          dependency.kind,
          source,
          this.state.accountKey,
          this.state.id,
          false,
        );
      }
      if (!archived?.targetId) {
        const response = await this.reader.list(
          `${dependency.kind}/${encodeURIComponent(dependency.id)}`,
          1,
          null,
          true,
        );
        const linked = response.records[0];
        if (!linked || (linked.id ?? linked._id) !== dependency.id)
          throw new Error('RD_REFERENCE_MISMATCH');
        await this.ensure(dependency.kind, linked, depth + 1);
        const result = await this.importer.import(
          dependency.kind,
          linked,
          this.state.accountKey,
          this.state.id,
          this.state.dryRun,
        );
        this.state.processed += 1;
        this.state[result] += 1;
        this.state.counts[dependency.kind] =
          (this.state.counts[dependency.kind] ?? 0) + 1;
        if (this.state.dryRun && this.state.selection)
          this.state.selection.dependencyKeys = [
            ...(this.state.selection.dependencyKeys ?? []),
            key,
          ];
      }
      this.verified.add(key);
    }
  }
}
