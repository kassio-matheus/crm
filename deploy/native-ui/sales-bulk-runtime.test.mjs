import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { phaseScope } from './sales-bulk-policy.mjs';
import * as policy from './sales-bulk-policy.mjs';

test('a phase panel never broadens native selection to the whole workspace, even if its in-memory scope is later lost', () => {
  const source = readFileSync(
    new URL('./sales-bulk-runtime.mjs', import.meta.url),
    'utf8',
  ).replace('export const createSalesBulkUi', 'const createSalesBulkUi');
  const factory = runInNewContext(source + ';createSalesBulkUi', {
    phaseScope,
    crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000001' },
  });
  const writes = new Map(),
    atomFamily = ({ instanceId }) => instanceId;
  const ui = factory({
    React: { createElement: () => null },
    objectId: { atomFamily: ({ instanceId }) => 'object:' + instanceId },
    rule: { atomFamily },
  });
  let page;
  ui.openPhase(
    (value) => {
      page = value;
    },
    { salesPipelineId: { eq: 'pipeline' } },
    '00000000-0000-4000-8000-000000000002',
    { set: (key, value) => writes.set(key, value) },
    'object',
  );
  assert.ok(ui.hasScope(page.pageId));
  assert.equal(writes.get('object:' + page.pageId), 'object');
  assert.equal(
    JSON.stringify(writes.get(page.pageId)),
    JSON.stringify({ mode: 'selection', selectedRecordIds: [] }),
  );
  assert.equal(page.page, 'update-records');
});

// Exercise the real panel callbacks and asynchronous effects with the native
// hooks/API boundary stubbed. No DOM implementation or RD endpoint is involved.
const ownerHarness = ({ canUpdate = true } = {}) => {
  const hooks = [],
    effects = [],
    queries = [],
    updates = [],
    dialogs = [];
  let cursor = 0,
    dirty = true,
    tree;
  const records = Array.from({ length: 151 }, (_, index) => ({
    id: `deal-${index}`,
    salesPipelineId: 'pipeline',
    salesStageId: 'stage',
  }));
  const members = Array.from({ length: 101 }, (_, index) => ({
    id: `member-${index}`,
    name: { firstName: 'Member', lastName: String(index) },
  }));
  let memberExists = true;
  const page = (items, after) => {
    const offset = Number(after || 0),
      next = offset + 100;
    return {
      edges: items.slice(offset, next).map((node) => ({ node })),
      pageInfo: { hasNextPage: next < items.length, endCursor: String(next) },
    };
  };
  const React = {
    Fragment: 'fragment',
    createElement: (type, props, ...children) => ({
      type,
      props: props || {},
      children,
    }),
    useState: (initial) => {
      const index = cursor++;
      if (!(index in hooks))
        hooks[index] = typeof initial === 'function' ? initial() : initial;
      return [
        hooks[index],
        (next) => {
          hooks[index] = typeof next === 'function' ? next(hooks[index]) : next;
          dirty = true;
        },
      ];
    },
    useRef: (initial) => {
      const index = cursor++;
      return (hooks[index] ||= { current: initial });
    },
    useEffect: (effect, deps) => {
      const index = cursor++;
      if (
        !hooks[index] ||
        deps.some((value, key) => !Object.is(value, hooks[index].deps[key]))
      ) {
        const previous = hooks[index];
        hooks[index] = { deps };
        effects.push(() => {
          previous?.cleanup?.();
          hooks[index].cleanup = effect();
        });
      }
    },
  };
  const client = {
    query: async (request) => {
      queries.push(request);
      const query = request.query;
      if (query.includes('CrmBulkSnapshot'))
        return {
          data: { opportunities: page(records, request.variables.after) },
        };
      if (query.includes('CrmBulkOwners'))
        return {
          data: { workspaceMembers: page(members, request.variables.after) },
        };
      if (query.includes('CrmValidateOwner'))
        return {
          data: {
            workspaceMember: memberExists
              ? members.find((member) => member.id === request.variables.id)
              : null,
          },
        };
      const name = query.includes('salesPipelines(')
        ? 'salesPipelines'
        : 'salesStages';
      return { data: { [name]: page([], null) } };
    },
  };
  const host = {
    React,
    Button: 'button',
    Form: 'form',
    Dialog: 'dialog',
    useTheme: () => ({
      spacing: { 1: 4, 3: 12, 4: 16 },
      font: {
        color: { primary: 'black', secondary: 'grey' },
        size: { sm: 12 },
      },
    }),
    useCoreClient: () => client,
    useMetadata: () => ({
      objectMetadataItem: {
        id: 'opportunity',
        fields: [],
        readableFields: [],
        isUICreatable: true,
      },
    }),
    useStateValue: () => [],
    useAtomValue: () => [],
    useDependencies: () => ({}),
    useCreate: () => ({
      createManyRecords: () => {
        throw new Error('Unexpected creation');
      },
    }),
    useUpdate: () => ({
      updateManyRecords: async (input) => {
        updates.push(JSON.parse(JSON.stringify(input)));
        return input.recordIdsToUpdate.map((id) => ({ id }));
      },
    }),
    usePermissions: () => ({
      objectPermissionsByObjectMetadataId: {
        opportunity: {
          canUpdateObjectRecords: canUpdate,
          canSoftDeleteObjectRecords: true,
        },
      },
    }),
    useToast: () => ({ enqueueToast: () => {} }),
    useDialog: () => ({ openDialog: (id) => dialogs.push(id) }),
    gql: (query) => query,
    objectId: { atomFamily: () => 'object' },
    rule: { atomFamily: () => 'rule' },
  };
  const source = readFileSync(
    new URL('./sales-bulk-runtime.mjs', import.meta.url),
    'utf8',
  ).replace('export const createSalesBulkUi', 'const createSalesBulkUi');
  const factory = runInNewContext(source + ';createSalesBulkUi', {
    ...policy,
    crypto: { randomUUID: () => 'selection' },
  });
  const ui = factory(host);
  let id;
  ui.openPhase(
    (page) => {
      id = page.pageId;
    },
    { ownerId: { eq: 'old-owner' } },
    '00000000-0000-4000-8000-000000000002',
    { set: () => {} },
    'opportunity',
  );
  const render = () => {
    cursor = 0;
    dirty = false;
    tree = ui.Panel({ contextStoreInstanceId: id });
  };
  const nodes = (node = tree) =>
    !node || typeof node !== 'object'
      ? []
      : [
          node,
          ...(node.children || [])
            .flat(Infinity)
            .flatMap((child) => nodes(child)),
        ];
  const settle = async () => {
    for (let turn = 0; turn < 20; turn++) {
      if (dirty) render();
      effects.splice(0).forEach((effect) => effect());
      await new Promise(setImmediate);
      if (!dirty && !effects.length) return;
    }
    throw new Error('Panel did not settle');
  };
  const button = (label) =>
    nodes().find(
      (node) => node.type === 'button' && node.children.includes(label),
    );
  return {
    settle,
    button,
    queries,
    updates,
    dialogs,
    records,
    picker: () =>
      nodes().find(
        (node) =>
          node.type === ui.Picker &&
          node.props.label === 'Proprietário de destino',
      ),
    confirm: () =>
      nodes()
        .find((node) => node.type === 'dialog')
        .props.onConfirmClick(),
    removeMember: () => {
      memberExists = false;
    },
    text: () => JSON.stringify(tree),
  };
};

test('owner action paginates members and selection, confirms, and writes only ownerId to the frozen IDs in batches', async () => {
  const harness = ownerHarness();
  await harness.settle();
  harness.button('Alterar proprietário').props.onClick();
  await harness.settle();
  assert.equal(harness.picker().props.options.length, 101);
  assert.equal(
    harness.button('Alterar proprietário · 151').props.disabled,
    true,
  );
  harness.picker().props.onChange('member-100');
  await harness.settle();
  assert.equal(
    harness.button('Alterar proprietário · 151').props.disabled,
    false,
  );
  assert.equal(harness.updates.length, 0);
  harness.button('Alterar proprietário · 151').props.onClick();
  assert.equal(harness.dialogs.length, 1);
  await harness.confirm();
  assert.deepEqual(
    harness.updates.map((batch) => batch.recordIdsToUpdate.length),
    [25, 25, 25, 25, 25, 25, 1],
  );
  assert.deepEqual(
    harness.updates.flatMap((batch) => batch.recordIdsToUpdate),
    harness.records.map((record) => record.id),
  );
  for (const batch of harness.updates)
    assert.deepEqual(batch.updateOneRecordInput, { ownerId: 'member-100' });
  const queries = harness.queries;
  assert.equal(
    queries.filter((request) => request.query.includes('CrmBulkOwners')).length,
    2,
  );
  assert.equal(
    queries.filter((request) => request.query.includes('CrmBulkSnapshot'))
      .length,
    2,
  );
  assert.equal(
    queries.filter((request) => request.query.includes('CrmValidateOwner'))
      .length,
    1,
  );
  assert.deepEqual(JSON.parse(JSON.stringify(queries[0].variables.filter)), {
    and: [
      { ownerId: { eq: 'old-owner' } },
      { salesStageId: { eq: '00000000-0000-4000-8000-000000000002' } },
    ],
  });
});

test('a member removed after confirmation cannot receive any selected deals', async () => {
  const harness = ownerHarness();
  await harness.settle();
  harness.button('Alterar proprietário').props.onClick();
  await harness.settle();
  harness.picker().props.onChange('member-100');
  await harness.settle();
  harness.button('Alterar proprietário · 151').props.onClick();
  harness.removeMember();
  await harness.confirm();
  await harness.settle();
  assert.equal(harness.updates.length, 0);
  assert.match(harness.text(), /Nenhuma negociação foi alterada/);
});

test('owner reassignment respects native record update permissions', async () => {
  const harness = ownerHarness({ canUpdate: false });
  await harness.settle();
  assert.equal(harness.button('Alterar proprietário').props.disabled, true);
  harness.button('Alterar proprietário').props.onClick();
  await harness.settle();
  harness.picker().props.onChange('member-100');
  await harness.settle();
  harness.button('Alterar proprietário · 151').props.onClick();
  await harness.confirm();
  assert.equal(harness.dialogs.length, 0);
  assert.equal(harness.updates.length, 0);
});
