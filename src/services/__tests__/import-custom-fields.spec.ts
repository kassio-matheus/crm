import { expect, it, vi } from 'vitest';
import type { CoreApiClient } from 'twenty-client-sdk/core';
import type { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { ImportCustomFields } from '../import-custom-fields';
import { rdCustomProjection } from 'src/utils/rd-custom-projection.util';
const setup = () => {
  const query = vi.fn().mockResolvedValue({ rdSourceRecords: { edges: [] } });
  const mutation = vi.fn();
  const fields: Record<string, unknown>[] = [];
  const metadataQuery = vi.fn(async (request) => {
    if (request.objects)
      return {
        objects: { edges: [{ node: { id: 'object', fieldsList: fields } }] },
      };
    if (request.getViews)
      return {
        getViews: [
          {
            id: 'fields-view',
            universalIdentifier: '5cf614b6-530f-4947-b6b9-c434df5741f6',
          },
        ],
      };
    return { getViewFields: [], getViewFieldGroups: [{ id: 'other' }] };
  });
  const metadataMutation = vi.fn(async (request) =>
    request.createOneField
      ? {
          createOneField: {
            ...request.createOneField.__args.input.field,
            id: 'native-field',
          },
        }
      : {},
  );
  return {
    query,
    mutation,
    metadataQuery,
    metadataMutation,
    fields,
    service: new ImportCustomFields(
      { query, mutation } as unknown as CoreApiClient,
      {
        query: metadataQuery,
        mutation: metadataMutation,
      } as unknown as MetadataApiClient,
    ),
  };
};
it('validates current catalog types during simulation without metadata or business writes', async () => {
  const t = setup();
  t.service.withCatalog([{ slug: 'n', type: 'number', entity: 'deal' }]);
  await expect(
    t.service.project({ custom_fields: { n: 'invalid' } }, 'account', true),
  ).rejects.toThrow('RD_INVALID_CUSTOM_FIELD_VALUE');
  expect(t.metadataMutation).not.toHaveBeenCalled();
  expect(t.mutation).not.toHaveBeenCalled();
});
it('creates native custom fields and places them on the native record view once per batch', async () => {
  const t = setup();
  t.service.withCatalog([
    { slug: 'answer', name: 'Resposta', type: 'text', entity: 'deal' },
  ]);
  const projected = await t.service.project(
    { custom_fields: { answer: '' } },
    'account',
    false,
  );
  await t.service.project(
    { custom_fields: { answer: 'Sim' } },
    'account',
    false,
  );
  expect(Object.values(projected)).toEqual(['']);
  const creates = t.metadataMutation.mock.calls.filter(
    ([r]) => r.createOneField,
  );
  expect(creates).toHaveLength(1);
  expect(creates[0][0].createOneField.__args.input.field).toMatchObject({
    label: 'Resposta',
    type: 'TEXT',
    objectMetadataId: 'object',
    isNullable: true,
  });
  expect(t.metadataMutation.mock.calls.some(([r]) => r.createViewField)).toBe(
    true,
  );
});
it('refuses a field name collision or incompatible type instead of changing the schema', async () => {
  const t = setup();
  const projection = rdCustomProjection('account', 'answer', 'Sim');
  t.fields.push({
    id: 'unrelated',
    name: projection.name,
    type: 'NUMBER',
    description: 'manual',
  });
  await expect(
    t.service.project({ custom_fields: { answer: 'Sim' } }, 'account', false),
  ).rejects.toThrow('RD_CUSTOM_FIELD_SCHEMA_CONFLICT');
  expect(t.metadataMutation).not.toHaveBeenCalled();
});
it('fills only a null canonical custom field, preserving blank or manually edited values', async () => {
  const t = setup();
  const a = rdCustomProjection('a', 'one', 'yes').name,
    b = rdCustomProjection('a', 'two', 'yes').name;
  t.query.mockResolvedValue({
    opportunities: {
      edges: [{ node: { id: 'native', [a]: null, [b]: 'manual' } }],
    },
  });
  await t.service.fillMissing('a:deals:x', { [a]: 'source', [b]: 'source' });
  expect(t.mutation).toHaveBeenCalledTimes(1);
  expect(t.mutation.mock.calls[0][0].updateOpportunities.__args).toMatchObject({
    filter: { rdSourceKey: { eq: 'a:deals:x' }, [a]: { is: 'NULL' } },
    data: { [a]: 'source' },
  });
});

it('defers enum creation with no available options and creates it when a source choice appears', async () => {
  const t = setup();
  t.service.withCatalog([
    { slug: 'state', type: 'option', entity: 'deal', options: [] },
  ]);
  expect(
    await t.service.project({ custom_fields: { state: '' } }, 'a', false),
  ).toEqual({});
  expect(t.metadataQuery).not.toHaveBeenCalled();
  expect(t.metadataMutation).not.toHaveBeenCalled();
  const next = await t.service.project(
    { custom_fields: { state: 'MT' } },
    'a',
    false,
  );
  expect(Object.values(next)[0]).toMatch(/^RD_/);
  expect(
    t.metadataMutation.mock.calls[0][0].createOneField.__args.input.field
      .options,
  ).toMatchObject([{ label: 'MT' }]);
});

it('reports a safe destination error without exposing metadata response contents', async () => {
  const t = setup();
  const error = Object.assign(new Error('PRIVATE token=SECRET'), {
    errors: [{ extensions: { code: 'FORBIDDEN' } }],
  });
  t.metadataQuery.mockRejectedValue(error);
  await expect(
    t.service.project({ custom_fields: { answer: 'Sim' } }, 'a', false),
  ).rejects.toThrow(
    /RD_CUSTOM_FIELD_SETUP: rdCustom[0-9a-f]{32} \(FORBIDDEN\)/,
  );
});
