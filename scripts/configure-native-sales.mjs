import { execFileSync } from 'node:child_process';
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
const request = (query, variables = {}) => {
  const result = JSON.parse(
    execFileSync(
      cli,
      [
        'api',
        'graphql',
        '--metadata',
        '--query',
        query,
        '--variables',
        JSON.stringify(variables),
        '--json',
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
const directory = resolve(import.meta.dirname, '../.twenty/backups');
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
            { locale: 'pt-BR', property: 'labelSingular', value: 'Negociação' },
            { locale: 'pt-BR', property: 'labelPlural', value: 'Negociações' },
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
if (navigation && navigation.position !== -2) {
  request(
    'mutation($input:UpdateOneNavigationMenuItemInput!){updateNavigationMenuItem(input:$input){id}}',
    { input: { id: navigation.id, update: { position: -2 } } },
  );
  changed++;
}
console.log(
  `Native sales layout configured (${changed} changes). Original settings saved locally.`,
);
