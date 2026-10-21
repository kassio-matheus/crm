export type SalesDeal = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  rdCreatedAt?: string | null;
  stage: string;
  salesStageKey?: string | null;
  salesPipelineKey?: string | null;
  dealStatus?: 'ONGOING' | 'WON' | 'LOST' | 'PAUSED' | null;
  qualification?: number | null;
  ownerId?: string | null;
  rdOwnerName?: string | null;
  rdOwnerId?: string | null;
  closeDate?: string | null;
  nextActivityAt?: string | null;
  lastContactAt?: string | null;
  amount?: {
    amountMicros?: string | number | null;
    currencyCode?: string | null;
  } | null;
  company?: { id: string; name?: string | null } | null;
  pointOfContact?: {
    id: string;
    name?: { firstName?: string | null; lastName?: string | null } | null;
    emails?: { primaryEmail?: string | null } | null;
    phones?: { primaryPhoneNumber?: string | null } | null;
  } | null;
  owner?: {
    id: string;
    name?: { firstName?: string | null; lastName?: string | null } | null;
  } | null;
  rdOriginalData?: Record<string, unknown> | null;
};
