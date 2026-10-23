export const importDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const value = Math.floor(seconds);
  if (value < 60) return `${value}s`;
  if (value < 3600) return `${Math.floor(value / 60)}min ${value % 60}s`;
  return `${Math.floor(value / 3600)}h ${Math.floor((value % 3600) / 60)}min`;
};
