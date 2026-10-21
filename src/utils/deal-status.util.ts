export const dealStatus = (record: Record<string, unknown>): 'ONGOING' | 'WON' | 'LOST' | 'PAUSED' => {
  if (record.status === 'won' || record.win === true) return 'WON';
  if (record.status === 'lost' || record.win === false) return 'LOST';
  if (record.status === 'paused' || record.hold === true) return 'PAUSED';
  if (record.status && record.status !== 'ongoing') throw new Error('Unsupported RD deal status; import stopped to avoid changing its meaning.');
  return 'ONGOING';
};
