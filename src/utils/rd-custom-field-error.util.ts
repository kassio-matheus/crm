/** Surface only known destination error codes, never response bodies or field values. */
export const rdCustomFieldError = (error: unknown, field: string): Error => {
  const allowed = new Set([
    'FORBIDDEN',
    'UNAUTHENTICATED',
    'BAD_USER_INPUT',
    'INVALID_FIELD_INPUT',
    'GRAPHQL_VALIDATION_FAILED',
    'INTERNAL_SERVER_ERROR',
  ]);
  const errors = (error as { errors?: unknown } | null)?.errors;
  const code = Array.isArray(errors)
    ? errors
        .map((item) => item?.extensions?.code)
        .find((item) => allowed.has(item))
    : undefined;
  const name = /^rdCustom[0-9a-f]{32}$/.test(field) ? field : 'custom field';
  return new Error(
    `RD_CUSTOM_FIELD_SETUP: ${name} (${code ?? 'UNKNOWN'}). Twenty could not prepare this native field. Review data-model access, option labels and the record layout before resuming.`,
  );
};
