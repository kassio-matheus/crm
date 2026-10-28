export type ImportOwnerMatch = {
  sourceId: string;
  name: string;
  email: string;
  memberId: string | null;
  status: 'matched' | 'missing' | 'ambiguous';
  matchMethod?: 'email' | 'explicit';
  memberName?: string;
  memberEmail?: string;
};
