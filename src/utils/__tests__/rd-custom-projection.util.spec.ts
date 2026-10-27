import { expect, it } from 'vitest';
import { rdCustomProjection } from '../rd-custom-projection.util';
import { sourceId } from '../source-id.util';
it('keeps all original text including empty values and uses a stable English identifier', () => {
  const first = rdCustomProjection('account', 'ja-trabalha-com-acai', '', {
    slug: 'ja-trabalha-com-acai',
    entity: 'deal',
    type: 'text',
    name: 'Já trabalha com açaí?',
  });
  expect(first).toMatchObject({
    label: 'Já trabalha com açaí?',
    type: 'TEXT',
    value: '',
  });
  expect(first.name).toMatch(/^rdCustom[0-9a-f]{32}$/);
  expect(
    rdCustomProjection('account', 'ja-trabalha-com-acai', 'Sim').name,
  ).toBe(first.name);
  expect(rdCustomProjection('other', 'ja-trabalha-com-acai', '').name).not.toBe(
    first.name,
  );
});
it.each([0, -12.5, '123.50', '', null])(
  'maps numeric values without treating zero as empty: %s',
  (value) => {
    expect(
      rdCustomProjection('account', 'number', value, {
        slug: 'number',
        type: 'number',
      }),
    ).toMatchObject({
      type: 'NUMBER',
      value: value === '' || value === null ? null : Number(value),
    });
  },
);
it.each([NaN, Infinity, '1,00', {}, 'x'])(
  'rejects invalid numeric data: %s',
  (value) =>
    expect(() =>
      rdCustomProjection('account', 'n', value, { slug: 'n', type: 'number' }),
    ).toThrow('RD_INVALID_CUSTOM_FIELD_VALUE'),
);
it('keeps false, leap dates, URLs and unknown structures', () => {
  expect(rdCustomProjection('a', 'flag', false)).toMatchObject({
    type: 'BOOLEAN',
    value: false,
  });
  expect(
    rdCustomProjection('a', 'day', '2024-02-29', { slug: 'day', type: 'date' })
      .value,
  ).toBe('2024-02-29');
  expect(() =>
    rdCustomProjection('a', 'day', '2026-02-30', { slug: 'day', type: 'date' }),
  ).toThrow('RD_INVALID_CUSTOM_FIELD_VALUE');
  expect(
    rdCustomProjection('a', 'url', 'https://example.com', {
      slug: 'url',
      type: 'hyperlink',
    }),
  ).toMatchObject({ type: 'TEXT', value: 'https://example.com' });
  expect(rdCustomProjection('a', 'future', { nested: [1] })).toMatchObject({
    type: 'RAW_JSON',
    value: { nested: [1] },
  });
});
it('maps select labels to stable native option values and preserves observed new options', () => {
  const definition = {
    slug: 'answer',
    type: 'option',
    options: ['Sim', 'Não'],
  };
  const first = rdCustomProjection('a', 'answer', 'Sim', definition);
  const second = rdCustomProjection('a', 'answer', 'Talvez', definition);
  expect(first.type).toBe('SELECT');
  expect(first.value).toMatch(/^RD_[0-9A-F]{32}$/);
  expect(second.options).toHaveLength(3);
  expect(second.options![0].value).toBe(first.value);
  expect(rdCustomProjection('a', 'answer', '', definition).value).toBeNull();
});
it('maps multiple choices and rejects arrays in a text definition', () => {
  const result = rdCustomProjection('a', 'choices', ['A', 'B'], {
    slug: 'choices',
    type: 'multiple_choice',
    options: ['B'],
  });
  expect(result.type).toBe('MULTI_SELECT');
  expect(result.value).toHaveLength(2);
  expect(() =>
    rdCustomProjection('a', 'text', ['A'], { slug: 'text', type: 'text' }),
  ).toThrow('RD_INVALID_CUSTOM_FIELD_VALUE');
});

it('adapts RD enum labels while keeping the original option identity and selection', () => {
  const raw = 'Sim, tenho delivery.';
  const options = [raw, 'Não.'];
  const result = rdCustomProjection('a', 'answer', raw, {
    slug: 'answer',
    type: 'option',
    options,
  });
  const originalId = sourceId(`rd-custom:a:deal:answer:option:${raw}`);
  expect(result.options![0]).toMatchObject({
    id: originalId,
    label: 'Sim; tenho delivery.',
    value: `RD_${originalId.replace(/-/g, '').toUpperCase()}`,
  });
  expect(result.value).toBe(result.options![0].value);
  expect(options).toEqual([raw, 'Não.']);
  const multiple = rdCustomProjection('a', 'answer', [raw], {
    slug: 'answer',
    type: 'multiple_choice',
    options,
  });
  expect(multiple.value).toEqual([result.value]);
});
