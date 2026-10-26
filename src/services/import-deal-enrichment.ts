import { CoreApiClient, type CoreSchema } from 'twenty-client-sdk/core';
import { sourceId } from 'src/utils/source-id.util';

/** Fill new imported source fields only when null; existing local edits always win. */
export class ImportDealEnrichment {
  constructor(private core = new CoreApiClient()) {}
  async fillMissing(key: string, values: Record<string, unknown>) {
    const fields = [
      'rdSourceRecordId',
      'rdUpdatedAt',
      'rdCampaignId',
      'rdLeadSourceId',
    ];
    const base = { id: { eq: sourceId(key) }, rdSourceKey: { eq: key } };
    const result = await this.core.query({
      opportunities: {
        __args: { first: 1, filter: base },
        edges: {
          node: Object.fromEntries(
            ['id', ...fields].map((name) => [name, true]),
          ),
        },
      },
    } as Parameters<CoreApiClient['query']>[0]);
    const row = (
      result as unknown as {
        opportunities?: { edges: { node: Record<string, unknown> }[] };
      }
    ).opportunities?.edges[0]?.node as Record<string, unknown> | undefined;
    if (!row) return;
    for (const name of [...fields, 'rdOneTimeAmount', 'rdRecurringAmount']) {
      if (values[name] === null || values[name] === undefined) continue;
      const currency =
        name === 'rdOneTimeAmount' || name === 'rdRecurringAmount';
      if (!currency && row[name] !== null) continue;
      await this.core.mutation({
        updateOpportunities: {
          __args: {
            filter: {
              ...base,
              [name]: currency
                ? { amountMicros: { is: 'NULL' } }
                : { is: 'NULL' },
            } as CoreSchema.OpportunityFilterInput,
            data: { [name]: values[name] } as CoreSchema.OpportunityUpdateInput,
          },
          id: true,
        },
      });
    }
  }
}
