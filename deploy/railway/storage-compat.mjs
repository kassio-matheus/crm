import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const originalHash =
  '102ea068a3275f85ad702ea38f9eb854c6f760792dfd9b0c62e038b3deb28558';
const before = 'forcePathStyle: true,';
const after =
  "forcePathStyle: process.env.STORAGE_S3_FORCE_PATH_STYLE !== 'false',";
export function adaptStorageFactory(source) {
  const hash = createHash('sha256').update(source).digest('hex');
  if (hash === originalHash) return source.replace(before, after);
  if (
    source.includes(after) &&
    createHash('sha256').update(source.replace(after, before)).digest('hex') ===
      originalHash
  )
    return source;
  throw new Error(
    'Unsupported Twenty S3 factory. Review compatibility before upgrading.',
  );
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const path =
    '/app/packages/twenty-server/dist/engine/core-modules/file-storage/file-storage-driver.factory.js';
  await writeFile(path, adaptStorageFactory(await readFile(path, 'utf8')));
  console.log('Twenty v2.50.1 S3 virtual-host compatibility applied.');
}
