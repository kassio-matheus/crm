import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { open, stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';

const magic = Buffer.from('CRMBAK01');
const headerSize = magic.length + 12;
export function parseKey(value) {
  if (!/^[a-f0-9]{64}$/.test(value ?? ''))
    throw new Error(
      'A dedicated 64-character hexadecimal backup key is required.',
    );
  return Buffer.from(value, 'hex');
}
export async function encryptDump(input, output, key) {
  const iv = randomBytes(12);
  const header = Buffer.concat([magic, iv]);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(header);
  const handle = await open(output, 'wx', 0o600);
  await handle.write(header);
  await handle.close();
  await pipeline(input, cipher, createWriteStream(output, { flags: 'a' }));
  const tail = await open(output, 'a');
  try {
    await tail.write(cipher.getAuthTag());
  } finally {
    await tail.close();
  }
}
export async function decryptDump(input, output, key) {
  const size = (await stat(input)).size;
  if (size <= headerSize + 16) throw new Error('Invalid encrypted backup.');
  const file = await open(input, 'r');
  const header = Buffer.alloc(headerSize);
  const tag = Buffer.alloc(16);
  try {
    await file.read(header, 0, header.length, 0);
    await file.read(tag, 0, tag.length, size - tag.length);
  } finally {
    await file.close();
  }
  if (!header.subarray(0, magic.length).equals(magic))
    throw new Error('Unsupported backup format.');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    header.subarray(magic.length),
  );
  decipher.setAAD(header);
  decipher.setAuthTag(tag);
  await pipeline(
    createReadStream(input, { start: headerSize, end: size - 17 }),
    decipher,
    createWriteStream(output, { flags: 'wx', mode: 0o600 }),
  );
}
