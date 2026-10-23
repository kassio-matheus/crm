import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { randomBytes } from 'node:crypto';
import { encryptDump, decryptDump, parseKey } from './backup/crypto.mjs';

test('backup decrypts byte-for-byte and refuses tampering, wrong keys and overwrites', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'crm-backup-test-'));
  try {
    const data = randomBytes(128_000);
    const key = randomBytes(32);
    const encrypted = join(directory, 'backup.enc');
    const restored = join(directory, 'restored.dump');
    await encryptDump(Readable.from(data), encrypted, key);
    const bytes = await readFile(encrypted);
    assert.ok(!bytes.includes(data.subarray(0, 100)));
    await decryptDump(encrypted, restored, key);
    assert.deepEqual(await readFile(restored), data);
    await assert.rejects(decryptDump(encrypted, restored, key), /EEXIST/);
    await assert.rejects(
      decryptDump(encrypted, join(directory, 'wrong'), randomBytes(32)),
    );
    bytes[30] ^= 1;
    await writeFile(encrypted, bytes);
    await assert.rejects(
      decryptDump(encrypted, join(directory, 'tampered'), key),
    );
    assert.throws(() => parseKey('secret(64)'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
