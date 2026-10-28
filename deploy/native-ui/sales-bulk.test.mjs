import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  relationIds,
  phaseScope,
  readSnapshot,
  copyDeal,
  validateMove,
  printField,
  stagePickerFilter,
  assertBatchResult,
  isOperationalSalesField,
  salesFilterQuery,
  salesFilterPredicate,
} from './sales-bulk-policy.mjs';

const stage = '00000000-0000-4000-8000-000000000001';
test('only the retired opportunity fields are hidden; other objects and real pipeline relations remain available', () => {
  for (const field of ['stage', 'salesPipelineKey', 'salesStageKey'])
    assert.equal(isOperationalSalesField('opportunity', field), false);
  for (const field of [
    'salesPipeline',
    'salesStage',
    'dealStatus',
    'qualification',
  ])
    assert.equal(isOperationalSalesField('opportunity', field), true);
  assert.equal(isOperationalSalesField('project', 'stage'), true);
});
test('native filters open the selected managed board and use relation IDs for the selected stage and owner', () => {
  const value = {
    pipelineId: 'p',
    stageId: stage,
    ownerId: 'u',
    status: 'ALL',
    sort: 'newest',
    mode: 'board',
  };
  const query = salesFilterQuery(value, 'list');
  assert.equal(query.viewId, 'p');
  assert.equal(query['filterGroup[filters][1][field]'], 'salesStage');
  assert.equal(
    query['filterGroup[filters][1][value]'],
    JSON.stringify([stage]),
  );
  assert.deepEqual(salesFilterPredicate(value), {
    and: [
      { salesPipelineId: { eq: 'p' } },
      { salesStageId: { eq: stage } },
      { ownerId: { eq: 'u' } },
    ],
  });
  assert.equal(
    salesFilterQuery(
      { ...value, pipelineId: '', stageId: '', ownerId: '', mode: 'list' },
      'list',
    ).viewId,
    'list',
  );
});
test('status and unassigned-owner counts preserve null and legacy-status semantics', () => {
  const v = {
    pipelineId: 'p',
    stageId: '',
    ownerId: 'UNASSIGNED',
    status: 'NOT_PAUSED',
    sort: 'nameAsc',
    mode: 'list',
  };
  assert.equal(
    salesFilterQuery(v, 'list')['filterGroup[filters][1][op]'],
    'IS_EMPTY',
  );
  assert.equal(salesFilterQuery(v, 'list')['sort[name]'], 'ASC');
  assert.ok(salesFilterPredicate(v).and.some((filter) => filter.or));
  assert.ok(
    salesFilterPredicate({ ...v, status: 'ONGOING' }).and.some((filter) =>
      filter.or?.some((branch) => branch.and),
    ),
  );
});
test('a partial or missing mutation result is not reported as a successful batch', () => {
  assertBatchResult([{ id: 'a' }, { id: 'b' }], ['a', 'b']);
  assert.throws(() => assertBatchResult([{ id: 'a' }], ['a', 'b']));
  assert.throws(() => assertBatchResult(undefined, ['a']));
  assert.throws(() => assertBatchResult([{ id: 'other' }], ['a']));
});
test('native stage picker offers only the selected pipeline, and never leaks all stages without a pipeline', () => {
  const fields = [{ id: 'p-field', name: 'salesPipeline' }],
    filter = { fieldMetadataId: 'p-field', operand: 'IS', value: '["p"]' };
  assert.deepEqual(stagePickerFilter('salesStage', [filter], fields), {
    salesPipelineId: { in: ['p'] },
  });
  assert.deepEqual(
    stagePickerFilter(
      'salesStage',
      [{ ...filter, value: '{"selectedRecordIds":["p"]}' }],
      fields,
    ),
    { salesPipelineId: { in: ['p'] } },
  );
  assert.deepEqual(stagePickerFilter('salesStage', [], fields), {
    id: { in: [] },
  });
  assert.deepEqual(
    stagePickerFilter('salesStage', [{ ...filter, value: 'broken' }], fields),
    { id: { in: [] } },
  );
  assert.equal(stagePickerFilter('company', [filter], fields), undefined);
});
test('phase selection ANDs the stage with all current owner, pipeline and status criteria', () => {
  const filter = {
    and: [
      { salesPipelineId: { eq: 'p' } },
      { or: [{ ownerId: { eq: 'u' } }, { dealStatus: { eq: 'ONGOING' } }] },
    ],
  };
  assert.deepEqual(phaseScope(filter, stage), {
    and: [filter, { salesStageId: { eq: stage } }],
  });
  assert.throws(() => phaseScope(filter, 'not-an-id'));
});
test('relation constraints handle intersections, empty results and nested OR without treating an unrelated OR branch as mandatory', () => {
  assert.deepEqual(
    relationIds(
      {
        and: [
          { salesPipelineId: { in: ['p', 'q'] } },
          { salesPipelineId: { eq: 'p' } },
        ],
      },
      'salesPipelineId',
    ),
    ['p'],
  );
  assert.deepEqual(
    relationIds(
      {
        and: [
          { salesStageId: { in: ['s'] } },
          { salesStageId: { eq: 'other' } },
        ],
      },
      'salesStageId',
    ),
    [],
  );
  assert.deepEqual(
    relationIds(
      { or: [{ salesStageId: { eq: 'a' } }, { salesStageId: { eq: 'b' } }] },
      'salesStageId',
    ),
    ['a', 'b'],
  );
  assert.equal(
    relationIds(
      { or: [{ salesStageId: { eq: 'a' } }, { ownerId: { eq: 'u' } }] },
      'salesStageId',
    ),
    null,
  );
});
test('selection freezes every page before callers start writes, including records beyond the first hundred', async () => {
  const calls = [];
  const read = async ({ after }) => {
    calls.push(after);
    const start = after ? 100 : 0;
    return {
      edges: Array.from({ length: after ? 51 : 100 }, (_, i) => ({
        node: { id: String(start + i) },
      })),
      pageInfo: { hasNextPage: !after, endCursor: 'second' },
    };
  };
  const snapshot = await readSnapshot(read, phaseScope({}, stage));
  assert.equal(snapshot.length, 151);
  assert.deepEqual(calls, [null, 'second']);
  // A second generation of duplicate records never joins this frozen input.
  const initial = snapshot.map(({ id }) => id);
  snapshot.forEach((row) => {
    row.copied = true;
  });
  assert.equal(initial.length, 151);
});
test('pagination fails closed on repeated/missing cursors, missing pages and a falsely non-final empty page', async () => {
  for (const page of [
    null,
    { edges: [], pageInfo: { hasNextPage: true, endCursor: 'x' } },
    { edges: [{ node: { id: '1' } }], pageInfo: { hasNextPage: true } },
    {
      edges: [{ node: { id: '1' } }],
      pageInfo: { hasNextPage: true, endCursor: 'x' },
    },
  ])
    await assert.rejects(readSnapshot(async () => page, {}));
});
test('empty selections stay empty and overlapping pages do not duplicate records', async () => {
  assert.deepEqual(
    await readSnapshot(
      async () => ({ edges: [], pageInfo: { hasNextPage: false } }),
      {},
    ),
    [],
  );
  let calls = 0;
  assert.equal(
    (
      await readSnapshot(
        async () => ({
          edges: [{ node: { id: '1' } }],
          pageInfo: { hasNextPage: ++calls === 1, endCursor: 'x' },
        }),
        {},
      )
    ).length,
    1,
  );
});
test('moves write pipeline and stage together and reject stages belonging to another funnel or deleted stages', () => {
  const stages = [{ id: stage, salesPipelineId: 'p' }];
  assert.deepEqual(validateMove('stage', 'p', stage, stages), {
    salesPipelineId: 'p',
    salesStageId: stage,
  });
  assert.throws(() => validateMove('pipeline', 'other', stage, stages));
  assert.throws(() => validateMove('pipeline', 'p', stage, []));
  assert.throws(() => validateMove('delete', 'p', stage, stages));
});
test('duplicates retain business fields and owner without reusing RD identity, system metadata or child relations', () => {
  const field = (name, type = 'TEXT', settings) => ({
    name,
    type,
    settings,
    isActive: true,
  });
  const fields = [
    field('name'),
    field('qualification', 'NUMBER'),
    field('amount', 'CURRENCY'),
    field('owner', 'RELATION', {
      relationType: 'MANY_TO_ONE',
      joinColumnName: 'ownerId',
    }),
    field('salesStage', 'RELATION', { relationType: 'MANY_TO_ONE' }),
    field('tasks', 'RELATION', { relationType: 'ONE_TO_MANY' }),
    field('rdSourceKey'),
    field('rdOriginalData'),
    field('salesPipelineKey'),
    field('createdAt'),
    { ...field('secret'), isUIEditable: false },
    { ...field('unique'), isUnique: true },
  ];
  const copy = copyDeal(
    {
      id: 'original',
      name: 'Venda',
      qualification: 0,
      amount: { amountMicros: 0, currencyCode: 'BRL', __typename: 'Currency' },
      ownerId: 'member',
      salesStageId: stage,
      tasks: [{ id: 'task' }],
      rdSourceKey: 'rd:1',
      rdOriginalData: { id: 'rd' },
      salesPipelineKey: 'rd-p',
      createdAt: 'yesterday',
      secret: 'x',
      unique: 'y',
    },
    fields,
    'new',
  );
  assert.deepEqual(copy, {
    id: 'new',
    name: 'Venda · Cópia',
    qualification: 0,
    amount: { amountMicros: 0, currencyCode: 'BRL' },
    ownerId: 'member',
    salesStageId: stage,
  });
});
test('duplicate query prints composite scalar selections without interpolating customer values', () => {
  assert.equal(
    printField({ name: 'amount', type: 'CURRENCY' }),
    'amount{amountMicros currencyCode}',
  );
  assert.equal(printField({ name: 'custom', type: 'RAW_JSON' }), 'custom');
});
