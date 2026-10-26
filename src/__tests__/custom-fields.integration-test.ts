import { randomUUID } from 'node:crypto';
import { afterAll, expect, it } from 'vitest';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { RecordImporter } from 'src/services/record-importer';
import { rdCustomProjection } from 'src/utils/rd-custom-projection.util';
import { sourceId } from 'src/utils/source-id.util';
const core = new CoreApiClient(),
  metadata = new MetadataApiClient();
const account = `test-custom-${randomUUID()}`;
const importer = new RecordImporter(core);
const values = {
  question: '',
  score: 0,
  day: '2026-10-20',
  choice: 'Sim',
  choices: ['A', 'B'],
  future: { nested: [false, 1] },
};
const definitions = Object.entries({
  question: 'text',
  score: 'number',
  day: 'date',
  choice: 'option',
  choices: 'multiple_choice',
  future: 'future_type',
}).map(([slug, type]) => ({
  id: `def-${slug}`,
  entity: 'deal',
  slug,
  type,
  name: `RD ${slug}`,
  options:
    slug === 'choice' ? ['Sim', 'Não'] : slug === 'choices' ? ['A', 'B'] : [],
}));
const fieldNames = Object.keys(values).map(
  (slug) =>
    rdCustomProjection(
      account,
      slug,
      values[slug as keyof typeof values],
      definitions.find((d) => d.slug === slug),
    ).name,
);
afterAll(async () => {
  for (const external of ['deal', 'second'])
    await core.mutation({
      destroyOpportunity: {
        __args: { id: sourceId(`${account}:deals:${external}`) },
        id: true,
      },
    });
  const fields = await metadata.query({
    objects: {
      __args: {
        filter: {
          universalIdentifier: { eq: '20202020-9549-49dd-b2b2-883999db8938' },
        },
        paging: { first: 1 },
      },
      edges: { node: { fieldsList: { id: true, name: true } } },
    },
  });
  for (const field of fields.objects.edges[0].node.fieldsList ?? [])
    if (fieldNames.includes(field.name))
      await metadata.mutation({
        deleteOneField: { __args: { input: { id: field.id } }, id: true },
      });
  const snapshots = await core.query({
    rdSourceRecords: {
      __args: {
        first: 100,
        filter: { sourceKey: { startsWith: `${account}:` } },
      },
      edges: { node: { id: true } },
    },
  });
  for (const { node } of snapshots.rdSourceRecords!.edges)
    await core.mutation({
      destroyRdSourceRecord: { __args: { id: node.id }, id: true },
    });
});
it('creates typed native custom fields, projects the full deal and preserves edits on replay', async () => {
  for (const definition of definitions)
    await importer.import('custom_fields', definition, account, 'run', false);
  const record = {
    id: 'deal',
    name: 'Custom fixture',
    updated_at: '2026-10-20T13:12:09.469-03:00',
    source_id: 'source',
    campaign_id: 'campaign',
    one_time_price: 0,
    recurrence_price: 12.5,
    custom_fields: values,
  };
  await importer.import('deals', record, account, 'run', false);
  const read = async () => {
    const response = (await core.query({
      opportunities: {
        __args: { filter: { id: { eq: sourceId(`${account}:deals:deal`) } } },
        edges: {
          node: {
            id: true,
            rdOriginalData: true,
            rdCampaignId: true,
            rdSourceRecordId: true,
            rdOneTimeAmount: { amountMicros: true, currencyCode: true },
            ...Object.fromEntries(fieldNames.map((name) => [name, true])),
          },
        },
      },
    } as Parameters<CoreApiClient['query']>[0])) as unknown as {
      opportunities: { edges: { node: Record<string, unknown> }[] };
    };
    return response.opportunities.edges[0].node;
  };
  const first = await read();
  expect(first).toMatchObject({
    rdOriginalData: record,
    rdCampaignId: 'campaign',
    rdSourceRecordId: 'deal',
    rdOneTimeAmount: { amountMicros: 0, currencyCode: 'BRL' },
  });
  for (const [slug, value] of Object.entries(values)) {
    const projection = rdCustomProjection(
      account,
      slug,
      value,
      definitions.find((d) => d.slug === slug),
    );
    expect(first[projection.name]).toEqual(projection.value);
  }
  const question = rdCustomProjection(account, 'question', '').name;
  const score = rdCustomProjection(account, 'score', 0, definitions[1]).name;
  await core.mutation({
    updateOpportunity: {
      __args: {
        id: sourceId(`${account}:deals:deal`),
        data: { [question]: 'Manual edit', [score]: null },
      },
      id: true,
    },
  });
  await importer.import(
    'deals',
    {
      ...record,
      custom_fields: { ...values, question: 'Changed RD text', score: 8 },
    },
    account,
    'replay',
    false,
  );
  const replayed = await read();
  expect(replayed[question]).toBe('Manual edit');
  expect(replayed[score]).toBe(8);
  await importer.import(
    'deals',
    { id: 'second', custom_fields: { choice: 'Talvez' } },
    account,
    'run',
    false,
  );
  const views = await metadata.query({
    getViews: {
      id: true,
      universalIdentifier: true,
      viewFields: { fieldMetadataId: true, isVisible: true },
    },
  });
  const fieldsView = views.getViews.find(
    (v) => v.universalIdentifier === '5cf614b6-530f-4947-b6b9-c434df5741f6',
  );
  expect(
    fieldsView!.viewFields.filter((field) => field.isVisible).length,
  ).toBeGreaterThanOrEqual(6);
}, 300_000);
