import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  mkdirSync,
  writeFileSync,
  existsSync,
  accessSync,
  constants,
  readFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import {
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS as objects,
  STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS as layouts,
} from 'twenty-sdk/define';
import { NATIVE_SALES } from '../src/constants/native-sales.ts';

const cli =
  process.env.TWENTY_CLI_PATH ??
  process.env.PATH.split(':')
    .filter(
      (path) =>
        !path.includes('node_modules') &&
        !path.includes('.yarn') &&
        !path.includes('/xfs-'),
    )
    .map((path) => join(path, 'twenty'))
    .find((path) => {
      try {
        accessSync(path, constants.X_OK);
        return true;
      } catch {
        return false;
      }
    });
if (!cli)
  throw new Error('Install the standalone Twenty CLI, or set TWENTY_CLI_PATH.');

// Use the authenticated CLI remote. No access token is read, printed or stored by this script.
const request = (query, variables = {}, metadata = true) => {
  const result = JSON.parse(
    execFileSync(
      cli,
      [
        'api',
        'graphql',
        ...(metadata ? ['--metadata'] : []),
        '--query',
        query,
        '--variables',
        JSON.stringify(variables),
        '--json',
        ...(process.env.TWENTY_REMOTE
          ? ['--remote', process.env.TWENTY_REMOTE]
          : []),
      ],
      { encoding: 'utf8' },
    ),
  );
  if (!result.ok) throw new Error('Native sales layout configuration failed.');
  return result.data;
};
const state = request(
  `{ objects(paging:{first:1},filter:{universalIdentifier:{eq:"${objects.opportunity.universalIdentifier}"}}){edges{node{id nameSingular labelSingular labelPlural openRecordIn}}} getPageLayouts{ id universalIdentifier tabs{id universalIdentifier title position} } navigationMenuItems{id type targetObjectMetadataId userWorkspaceId position} }`,
);
const object = state.objects.edges
  .map((edge) => edge.node)
  .find((item) => item.nameSingular === 'opportunity');
const layout = state.getPageLayouts.find(
  (item) =>
    item.universalIdentifier ===
    layouts.opportunityRecordPage.universalIdentifier,
);
const home = layout?.tabs.find(
  (tab) =>
    tab.universalIdentifier ===
    layouts.opportunityRecordPage.tabs.home.universalIdentifier,
);
if (
  !object ||
  !home ||
  !layout.tabs.some(
    (tab) => tab.universalIdentifier === NATIVE_SALES.summaryTab,
  )
)
  throw new Error(
    `Native ${objects.opportunity.universalIdentifier} sales layout is unavailable. Apply the app first.`,
  );
const directory = resolve(
  import.meta.dirname,
  '../.twenty/backups/native-sales',
  object.id,
);
mkdirSync(directory, { recursive: true });
const backup = join(directory, 'native-sales-layout-before.json');
const navigation = state.navigationMenuItems.find(
  (item) =>
    item.type === 'OBJECT' &&
    item.targetObjectMetadataId === object.id &&
    !item.userWorkspaceId,
);
if (!existsSync(backup))
  writeFileSync(backup, JSON.stringify({ object, home, navigation }, null, 2), {
    mode: 0o600,
  });
const boardsOnly = process.argv.includes('--boards-only');
if (!boardsOnly) {
  let changed = 0;
  const receiptPath = join(directory, 'native-sales-layout-configured.json');
  const receipt = existsSync(receiptPath)
    ? JSON.parse(readFileSync(receiptPath, 'utf8'))
    : null;
  // This server returns the base openRecordIn enum even when a workspace override is stored.
  // Keep a local receipt so rerunning setup does not repeatedly write the same override.
  if (
    (object.openRecordIn !== 'SIDE_PANEL' && receipt?.objectId !== object.id) ||
    object.labelPlural !== 'Negociações'
  ) {
    request(
      'mutation($input:UpdateOneObjectInput!){updateOneObject(input:$input){id}}',
      {
        input: {
          id: object.id,
          update: {
            labelSingular: 'Negociação',
            labelPlural: 'Negociações',
            openRecordIn: 'SIDE_PANEL',
            translations: [
              {
                locale: 'pt-BR',
                property: 'labelSingular',
                value: 'Negociação',
              },
              {
                locale: 'pt-BR',
                property: 'labelPlural',
                value: 'Negociações',
              },
            ],
          },
        },
      },
    );
    changed++;
  }
  writeFileSync(
    receiptPath,
    JSON.stringify({ objectId: object.id, openRecordIn: 'SIDE_PANEL' }),
    { mode: 0o600 },
  );
  // The app summary becomes the pinned left column. Preserve the original complete details as a later tab.
  if (home.position !== 90 || home.title !== 'Todos os campos') {
    request(
      'mutation($id:String!,$input:UpdatePageLayoutTabInput!){updatePageLayoutTab(id:$id,input:$input){id}}',
      { id: home.id, input: { position: 90, title: 'Todos os campos' } },
    );
    changed++;
  }
  if (navigation && navigation.position !== 0) {
    request(
      'mutation($input:UpdateOneNavigationMenuItemInput!){updateNavigationMenuItem(input:$input){id}}',
      { input: { id: navigation.id, update: { position: 0 } } },
    );
    changed++;
  }
  console.log(
    `Native sales layout configured (${changed} changes). Original settings saved locally.`,
  );
}

// Defaults are workspace metadata. No record values are rewritten.
const localeArg = process.argv.indexOf('--locale');
const locale = localeArg >= 0 ? process.argv[localeArg + 1] : 'pt-BR';
if (!locale) throw new Error('Provide a locale after --locale.');
const defaults = request(
  '{ objects(paging:{first:100}){edges{node{id nameSingular fieldsList{id name type defaultValue}}}} navigationMenuItems{id name icon type targetObjectMetadataId folderId applicationId userWorkspaceId position pageLayoutId viewId link} }',
);
const snapshot = join(directory, 'sales-defaults-before.json');
if (!existsSync(snapshot))
  writeFileSync(snapshot, JSON.stringify(defaults, null, 2), { mode: 0o600 });
const labels = {
  opportunity: ['Negociação', 'Negociações'],
  company: ['Empresa', 'Empresas'],
  person: ['Contato', 'Contatos'],
  task: ['Tarefa', 'Tarefas'],
  note: ['Nota', 'Notas'],
};
const allObjects = defaults.objects.edges.map((e) => e.node);
if (!boardsOnly) {
  const allowed = new Map();
  for (const [position, [name, [singular, plural]]] of Object.entries(
    labels,
  ).entries()) {
    const target = allObjects.find((o) => o.nameSingular === name);
    if (!target) throw new Error(`Missing native ${name} object.`);
    allowed.set(target.id, { position, name: plural });
    request(
      'mutation($input:UpdateOneObjectInput!){updateOneObject(input:$input){id}}',
      {
        input: {
          id: target.id,
          update: {
            labelSingular: singular,
            labelPlural: plural,
            translations: [
              { locale: 'pt-BR', property: 'labelSingular', value: singular },
              { locale: 'pt-BR', property: 'labelPlural', value: plural },
            ],
          },
        },
      },
    );
  }
  for (const item of defaults.navigationMenuItems.filter(
    (n) => !n.userWorkspaceId,
  )) {
    const keep = allowed.get(item.targetObjectMetadataId);
    if (keep && item.type === 'OBJECT') {
      request(
        'mutation($input:UpdateOneNavigationMenuItemInput!){updateNavigationMenuItem(input:$input){id}}',
        {
          input: {
            id: item.id,
            update: {
              position: keep.position,
              name: keep.name,
              folderId: null,
            },
          },
        },
      );
    } else if (
      item.type === 'PAGE_LAYOUT' &&
      ['Importar RD Station', 'Importar do RD Station'].includes(item.name)
    ) {
      request(
        'mutation($input:UpdateOneNavigationMenuItemInput!){updateNavigationMenuItem(input:$input){id}}',
        {
          input: {
            id: item.id,
            update: {
              position: 5,
              name: 'Importar do RD Station',
              folderId: null,
            },
          },
        },
      );
    } else {
      // Delete only sidebar shortcuts. Their objects, records, views and layouts are retained.
      request('mutation($id:UUID!){deleteNavigationMenuItem(id:$id){id}}', {
        id: item.id,
      });
    }
  }
  if (locale.toLowerCase() === 'pt-br') {
    for (const target of allObjects)
      for (const field of target.fieldsList.filter(
        (f) => f.type === 'CURRENCY',
      )) {
        if (field.defaultValue?.currencyCode === "'BRL'") continue;
        request(
          'mutation($input:UpdateOneFieldMetadataInput!){updateOneField(input:$input){id}}',
          {
            input: {
              id: field.id,
              update: {
                defaultValue: {
                  ...(field.defaultValue || {}),
                  currencyCode: "'BRL'",
                },
              },
            },
          },
        );
      }
  }
  console.log(
    `Sales defaults configured for ${locale}: six workspace sidebar entries; ${locale.toLowerCase() === 'pt-br' ? 'BRL for new currency values' : 'currency defaults preserved'}.`,
  );
}

// Upgrade existing native boards too, including user-created views with legacy phase grouping.
const opportunity = allObjects.find((o) => o.nameSingular === 'opportunity');
const stageField = opportunity.fieldsList.find((f) => f.name === 'salesStage');
const pipelineField = opportunity.fieldsList.find(
  (f) => f.name === 'salesPipeline',
);
const loadCatalog = (name, fields) => {
  const rows = [];
  let cursor = null;
  do {
    const page = request(
      `query($after:String){${name}(first:100,after:$after){edges{node{${fields}}} pageInfo{hasNextPage endCursor}}}`,
      { after: cursor },
      false,
    )[name];
    rows.push(...page.edges.map((e) => e.node));
    const next = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    if (next && next === cursor)
      throw new Error('Catalog pagination did not advance.');
    cursor = next;
  } while (cursor);
  return rows;
};
const pipelines = loadCatalog('salesPipelines', 'id name');
const stages = loadCatalog(
  'salesStages',
  'id name salesPipelineId sourceOrder',
);
const nativeViews = request(
  'query($id:String!){getViews(objectMetadataId:$id){id name type mainGroupByFieldMetadataId}}',
  { id: opportunity.id },
).getViews;
const viewBackup = join(directory, 'native-views-before.json');
if (!existsSync(viewBackup))
  writeFileSync(
    viewBackup,
    JSON.stringify(
      nativeViews.map((view) => ({
        ...view,
        ...request(
          'query($id:String!){getViewFilters(viewId:$id){id fieldMetadataId operand value} getViewGroups(viewId:$id){id fieldValue position isVisible}}',
          { id: view.id },
        ),
      })),
      null,
      2,
    ),
    { mode: 0o600 },
  );
for (const view of nativeViews.filter((v) => v.type === 'KANBAN')) {
  const filters = request(
    'query($id:String!){getViewFilters(viewId:$id){id fieldMetadataId value}}',
    { id: view.id },
  ).getViewFilters;
  const filter = filters.find((f) => f.fieldMetadataId === pipelineField.id);
  let selected = filter
    ? typeof filter.value === 'string'
      ? JSON.parse(filter.value)
      : filter.value
    : [pipelines[0]?.id];
  selected = Array.isArray(selected) ? selected : selected?.selectedRecordIds;
  const pipelineId =
    Array.isArray(selected) && selected.length === 1 ? selected[0] : null;
  if (!pipelines.some((p) => p.id === pipelineId)) {
    request(
      'mutation($id:String!,$input:UpdateViewInput!){updateView(id:$id,input:$input){id}}',
      {
        id: view.id,
        input: { type: 'TABLE', mainGroupByFieldMetadataId: null },
      },
    );
    continue;
  }
  request(
    'mutation($id:String!,$input:UpdateViewInput!){updateView(id:$id,input:$input){id}}',
    {
      id: view.id,
      input: {
        mainGroupByFieldMetadataId: stageField.id,
        icon: 'IconLock',
        shouldHideEmptyGroups: false,
      },
    },
  );
  if (!filter)
    request(
      'mutation($input:CreateViewFilterInput!){createViewFilter(input:$input){id}}',
      {
        input: {
          id: randomUUID(),
          viewId: view.id,
          fieldMetadataId: pipelineField.id,
          operand: 'IS',
          value: JSON.stringify([pipelineId]),
        },
      },
    );
  const groups = request(
    'query($id:String!){getViewGroups(viewId:$id){id fieldValue position isVisible}}',
    { id: view.id },
  ).getViewGroups;
  const desired = stages
    .filter((s) => s.salesPipelineId === pipelineId)
    .sort(
      (a, b) =>
        (a.sourceOrder ?? Infinity) - (b.sourceOrder ?? Infinity) ||
        (a.name || '').localeCompare(b.name || '') ||
        a.id.localeCompare(b.id),
    );
  if (!groups.some((g) => !g.fieldValue))
    request(
      'mutation($input:CreateViewGroupInput!){createViewGroup(input:$input){id}}',
      {
        input: {
          id: randomUUID(),
          viewId: view.id,
          fieldValue: '',
          position: -1,
          isVisible: false,
        },
      },
    );
  for (const group of groups.filter((g) => !g.fieldValue && g.isVisible))
    request(
      'mutation($input:UpdateViewGroupInput!){updateViewGroup(input:$input){id}}',
      { input: { id: group.id, update: { isVisible: false } } },
    );
  for (const group of groups)
    if (group.fieldValue && !desired.some((s) => s.id === group.fieldValue))
      request(
        'mutation($input:DeleteViewGroupInput!){deleteViewGroup(input:$input){id}}',
        { input: { id: group.id } },
      );
  for (const [index, stage] of desired.entries()) {
    const group = groups.find((g) => g.fieldValue === stage.id);
    if (group && (!group.isVisible || group.position !== index))
      request(
        'mutation($input:UpdateViewGroupInput!){updateViewGroup(input:$input){id}}',
        {
          input: { id: group.id, update: { isVisible: true, position: index } },
        },
      );
    else if (!group)
      request(
        'mutation($input:CreateViewGroupInput!){createViewGroup(input:$input){id}}',
        {
          input: {
            id: randomUUID(),
            viewId: view.id,
            fieldValue: stage.id,
            position: index,
            isVisible: true,
          },
        },
      );
  }
}
console.log(
  'Existing native boards now group by their selected pipeline stages.',
);
