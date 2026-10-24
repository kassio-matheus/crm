export type ImportOwnerMatch = {
  sourceId: string;
  name: string;
  email: string;
  memberId: string | null;
  status: 'matched' | 'missing' | 'ambiguous';
};
