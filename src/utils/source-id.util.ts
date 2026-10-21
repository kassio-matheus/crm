import { createHash } from 'node:crypto';

/** Deterministic UUID v4 format: retries never generate a second destination record. */
export const sourceId = (key: string): string => {
  const hex = createHash('sha256').update(`twenty-rd-crm:${key}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 3) | 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};
