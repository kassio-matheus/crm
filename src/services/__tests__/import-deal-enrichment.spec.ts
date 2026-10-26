import { expect, it, vi } from 'vitest';
import type { CoreApiClient } from 'twenty-client-sdk/core';
import { ImportDealEnrichment } from '../import-deal-enrichment';
import { sourceId } from 'src/utils/source-id.util';
it('fills only missing scalar fields and guards currencies within the database write', async () => {
  const query = vi
    .fn()
    .mockResolvedValue({
      opportunities: {
        edges: [
          { node: { id: 'id', rdCampaignId: 'manual', rdLeadSourceId: null } },
        ],
      },
    });
  const mutation = vi.fn();
  await new ImportDealEnrichment({
    query,
    mutation,
  } as unknown as CoreApiClient).fillMissing('a:deals:x', {
    rdCampaignId: 'old',
    rdLeadSourceId: 'source',
    rdOneTimeAmount: { amountMicros: '0', currencyCode: 'BRL' },
  });
  expect(mutation).toHaveBeenCalledTimes(2);
  expect(mutation.mock.calls[0][0].updateOpportunities.__args).toMatchObject({
    filter: {
      id: { eq: sourceId('a:deals:x') },
      rdSourceKey: { eq: 'a:deals:x' },
      rdLeadSourceId: { is: 'NULL' },
    },
    data: { rdLeadSourceId: 'source' },
  });
  expect(
    mutation.mock.calls[1][0].updateOpportunities.__args.filter.rdOneTimeAmount,
  ).toEqual({ amountMicros: { is: 'NULL' } });
});
it('does not recreate a removed opportunity', async () => {
  const query = vi.fn().mockResolvedValue({ opportunities: { edges: [] } }),
    mutation = vi.fn();
  await new ImportDealEnrichment({
    query,
    mutation,
  } as unknown as CoreApiClient).fillMissing('a:deals:x', {
    rdSourceRecordId: 'x',
  });
  expect(mutation).not.toHaveBeenCalled();
});
