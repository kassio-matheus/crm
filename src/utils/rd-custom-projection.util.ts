import { sourceId } from 'src/utils/source-id.util';
import type { RdCustomField } from 'src/types/rd-custom-field';
import type { RdCustomProjection } from 'src/types/rd-custom-projection';

export const rdCustomProjection = (
  account: string,
  slug: string,
  value: unknown,
  definition?: RdCustomField,
): RdCustomProjection => {
  const identity = `rd-custom:${account}:deal:${slug}`;
  const type =
    definition?.type ??
    (typeof value === 'number'
      ? 'number'
      : typeof value === 'boolean'
        ? 'boolean'
        : Array.isArray(value) &&
            value.every((item) => typeof item === 'string')
          ? 'multiple_choice'
          : typeof value === 'string'
            ? 'text'
            : 'json');
  const base = {
    name: `rdCustom${sourceId(identity).replace(/-/g, '')}`,
    label: definition?.name || slug,
    description: identity,
  };
  if (type === 'text' || type === 'hyperlink') {
    if (value !== null && value !== undefined && typeof value !== 'string')
      throw new Error('RD_INVALID_CUSTOM_FIELD_VALUE: expected text.');
    return { ...base, type: 'TEXT', value: value ?? null };
  }
  if (type === 'number') {
    const number =
      value === '' || value === null || value === undefined
        ? null
        : typeof value === 'number'
          ? value
          : typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)
            ? Number(value)
            : NaN;
    if (number !== null && !Number.isFinite(number))
      throw new Error(
        'RD_INVALID_CUSTOM_FIELD_VALUE: expected a finite number.',
      );
    return { ...base, type: 'NUMBER', value: number };
  }
  if (type === 'boolean') {
    if (value !== null && value !== undefined && typeof value !== 'boolean')
      throw new Error('RD_INVALID_CUSTOM_FIELD_VALUE: expected boolean.');
    return { ...base, type: 'BOOLEAN', value: value ?? null };
  }
  if (type === 'date') {
    const day =
      value === '' || value === undefined || value === null
        ? null
        : typeof value === 'string'
          ? value.slice(0, 10)
          : '';
    if (
      day !== null &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(day) ||
        !Number.isFinite(Date.parse(day)) ||
        new Date(day).toISOString().slice(0, 10) !== day)
    )
      throw new Error('RD_INVALID_CUSTOM_FIELD_VALUE: invalid calendar date.');
    return { ...base, type: 'DATE', value: day };
  }
  if (type === 'option' || type === 'multiple_choice') {
    const values =
      value === '' || value === null || value === undefined
        ? []
        : type === 'option'
          ? [value]
          : value;
    if (
      !Array.isArray(values) ||
      !values.every((item) => typeof item === 'string')
    )
      throw new Error('RD_INVALID_CUSTOM_FIELD_VALUE: expected option labels.');
    const labels = [...new Set([...(definition?.options ?? []), ...values])];
    const optionValue = (label: string) =>
      `RD_${sourceId(`${identity}:option:${label}`).replace(/-/g, '').toUpperCase()}`;
    return {
      ...base,
      type: type === 'option' ? 'SELECT' : 'MULTI_SELECT',
      options: labels.map((label, position) => ({
        id: sourceId(`${identity}:option:${label}`),
        label,
        value: optionValue(label),
        position,
        color: 'blue',
      })),
      value:
        type === 'option'
          ? values.length
            ? optionValue(values[0])
            : null
          : values.map(optionValue),
    };
  }
  return { ...base, type: 'RAW_JSON', value: value ?? null };
};
