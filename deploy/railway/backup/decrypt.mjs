import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decryptDump, parseKey } from './crypto.mjs';

const [input, output] = process.argv.slice(2);
if (!input || !output || resolve(input) === resolve(output))
  throw new Error('Usage: node decrypt.mjs downloaded.dump.enc restored.dump');
let existed = false;
try {
  const { access } = await import('node:fs/promises');
  try {
    await access(output);
    existed = true;
  } catch {
    /* New destination. */
  }
  if (existed) throw new Error('Output already exists.');
  await decryptDump(input, output, parseKey(process.env.BACKUP_ENCRYPTION_KEY));
  console.log(
    'Authenticated backup decrypted. Restore only into an isolated empty database.',
  );
} catch (error) {
  if (!existed) await rm(output, { force: true });
  throw error;
}
