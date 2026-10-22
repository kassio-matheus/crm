import { CoreApiClient } from 'twenty-client-sdk/core';

/** Write just the independent status; pipeline, stage and amounts remain intact. */
export const updateDealStatus = async (
  id: string,
  status: 'WON' | 'LOST' | 'PAUSED' | 'ONGOING',
  client = new CoreApiClient(),
) => {
  if (!id || !['WON', 'LOST', 'PAUSED', 'ONGOING'].includes(status))
    throw new Error('Invalid deal status action.');
  await client.mutation({
    updateOpportunity: {
      __args: { id, data: { dealStatus: status } },
      id: true,
    },
  });
};
