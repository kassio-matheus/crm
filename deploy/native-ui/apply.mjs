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

const revision = 'crm-pipelines-v1';
const bundle = 'RecordIndexPage-D8zcMDY8.js';
const expectedSha256 =
  'b547da8d7d93a54d5ac6373d74edaea3ddd1fa784a15582fb11a147cf05777ce';
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
      hash(readFileSync(patchedPath)) !== applied.sha256
    )
      throw new Error(
        'Native UI patch receipt does not match the installed frontend.',
      );
    return;
  }
  const original = readFileSync(originalPath, 'utf8');
  if (hash(original) !== expectedSha256)
    throw new Error(
      'Unsupported Twenty frontend checksum; no files were changed.',
    );
  const patched = patchPicker(original);
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
    const source = file === originalPath ? patched : readFileSync(file, 'utf8');
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
  console.log('Native managed pipeline picker protection installed.');
}
