import { createHash } from 'node:crypto';
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  renameSync,
  existsSync,
} from 'node:fs';
import { join, basename, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { patchPicker } from './patch-picker.mjs';
import {
  patchSalesIndex,
  patchSalesBoard,
  patchSalesCommands,
  patchSalesPicker,
} from './patch-sales.mjs';

const revision = 'crm-sales-bulk-v6';
const bundle = 'RecordIndexPage-D8zcMDY8.js';
const expectedSha256 =
  'b547da8d7d93a54d5ac6373d74edaea3ddd1fa784a15582fb11a147cf05777ce';
const targets = [
  {
    bundle,
    checksum: expectedSha256,
    patch: (source) => patchSalesPicker(patchPicker(source)),
  },
  {
    bundle: 'index-CgifpLnX.js',
    checksum:
      'f6daa42c4c8931af768f908740c696b8e11e1f7739f6c5843ab9ccbdaabbab3c',
    patch: patchSalesIndex,
  },
  {
    bundle: 'useCombinedFindManyRecords-BsM_Luc_.js',
    checksum:
      '4f56bdb2c6b7e1622c2f5a5b290d3fc8c6c0b010caa468768ffd7716a35170f6',
    patch: patchSalesBoard,
  },
  {
    bundle: 'CommandMenuContextProvider-D98N3AUR.js',
    checksum:
      'dcee8332e411c279b13aaa0fe35a2c737498a32bb490fdb907ed162e908789a6',
    patch: patchSalesCommands,
  },
];
const hash = (value) => createHash('sha256').update(value).digest('hex');
const walk = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(join(directory, entry.name))
      : [join(directory, entry.name)],
  );

export const applyNativeUiPatch = (directory) => {
  const marker = join(directory, '.crm-native-ui.json');
  const originalPath = join(directory, 'assets', bundle);
  const patchedPath = originalPath.replace(/\.js$/, `.${revision}.js`);
  if (existsSync(marker)) {
    const applied = JSON.parse(readFileSync(marker, 'utf8'));
    if (
      applied.revision !== revision ||
      !existsSync(patchedPath) ||
      hash(readFileSync(patchedPath)) !== applied.sha256 ||
      !targets.every((target) => {
        const path = join(
          directory,
          'assets',
          target.bundle.replace(/\.js$/, `.${revision}.js`),
        );
        return (
          existsSync(path) &&
          hash(readFileSync(path)) === applied.files?.[target.bundle]
        );
      })
    )
      throw new Error(
        'Native UI patch receipt does not match the installed frontend.',
      );
    return;
  }
  // Validate and transform ALL supported bundles before the first disk write.
  const replacements = new Map();
  for (const target of targets) {
    const path = join(directory, 'assets', target.bundle);
    const original = readFileSync(path, 'utf8');
    if (hash(original) !== target.checksum)
      throw new Error(
        'Unsupported Twenty frontend checksum; no files were changed.',
      );
    replacements.set(path, target.patch(original));
  }
  const files = walk(directory);
  const names = new Map(
    files
      .filter((file) => ['.js', '.css'].includes(extname(file)))
      .map((file) => [
        basename(file),
        basename(file).replace(/\.(js|css)$/, `.${revision}.$1`),
      ]),
  );
  // Every JS/CSS URL changes, including lazy importers. Browsers cannot reuse stale
  // cached importers or the previous picker after the image is upgraded.
  for (const file of files.filter((file) =>
    ['.js', '.css', '.html', '.json'].includes(extname(file)),
  )) {
    const source = replacements.get(file) ?? readFileSync(file, 'utf8');
    writeFileSync(
      file,
      source.replace(
        /[A-Za-z0-9_@.-]+\.(?:js|css)\b/g,
        (name) => names.get(name) ?? name,
      ),
    );
  }
  for (const file of files) {
    const next = names.get(basename(file));
    if (next) renameSync(file, join(file, '..', next));
  }
  writeFileSync(
    marker,
    JSON.stringify({
      revision,
      upstream: 'twenty/v2.50.1',
      sha256: hash(readFileSync(patchedPath)),
      files: Object.fromEntries(
        targets.map((target) => [
          target.bundle,
          hash(
            readFileSync(
              join(
                directory,
                'assets',
                target.bundle.replace(/\.js$/, `.${revision}.js`),
              ),
            ),
          ),
        ]),
      ),
    }),
  );
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  applyNativeUiPatch(
    process.argv[2] ?? '/app/packages/twenty-server/dist/front',
  );
  console.log(
    'Native sales selection, actions and pipeline filters installed.',
  );
}
