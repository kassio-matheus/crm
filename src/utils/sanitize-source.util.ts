/** Source snapshots may contain integration secrets; omit them recursively. */
export const sanitizeSource = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitizeSource);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).filter(([key]) => !/(?:token|secret|password|authorization|api_key)/i.test(key))
      .map(([key, nested]) => [key, sanitizeSource(nested)]),
  );
  return value;
};
