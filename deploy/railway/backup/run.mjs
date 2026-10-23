import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { encryptDump, parseKey } from './crypto.mjs';

// Use the AWS SDK already shipped by the pinned official Twenty image.
const require = createRequire('/app/packages/twenty-server/package.json');
const {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');
let directory;
let client;
let child;
const deadline = setTimeout(() => {
  console.error('Backup exceeded its 45-minute limit.');
  child?.kill('SIGTERM');
  process.exit(1);
}, 45 * 60_000);
deadline.unref();
try {
  const key = parseKey(process.env.BACKUP_ENCRYPTION_KEY);
  if (process.env.BACKUP_ENCRYPTION_KEY === process.env.ENCRYPTION_KEY)
    throw new Error('Use an independent backup encryption key.');
  const url = new URL(process.env.PG_DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new Error('A PostgreSQL URL is required.');
  const endpoint = new URL(process.env.STORAGE_S3_ENDPOINT);
  if (endpoint.protocol !== 'https:') throw new Error('S3 must use HTTPS.');
  client = new S3Client({
    endpoint: endpoint.href,
    region: process.env.STORAGE_S3_REGION,
    forcePathStyle: false,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    credentials: {
      accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY,
    },
  });
  directory = await mkdtemp(join(tmpdir(), 'crm-backup-'));
  const path = join(directory, 'database.dump.enc');
  child = spawn(
    '/usr/libexec/postgresql16/pg_dump',
    ['--format=custom', '--compress=6', '--no-owner', '--no-acl'],
    {
      env: {
        ...process.env,
        PGHOST: url.hostname,
        PGPORT: url.port || '5432',
        PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
        PGUSER: decodeURIComponent(url.username),
        PGPASSWORD: decodeURIComponent(url.password),
        PGCONNECT_TIMEOUT: '30',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  // Capture errors without logging connection credentials or record content.
  child.stderr.resume();
  const completed = new Promise((resolve, reject) => {
    child.once('error', () => reject(new Error('Could not start pg_dump.')));
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error('PostgreSQL backup failed.')),
    );
  });
  await Promise.all([encryptDump(child.stdout, path, key), completed]);
  const size = (await stat(path)).size;
  const objectKey = `maintenance/postgres/${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}.dump.enc`;
  const Bucket = process.env.STORAGE_S3_NAME;
  await client.send(
    new PutObjectCommand({
      Bucket,
      Key: objectKey,
      Body: createReadStream(path),
      ContentLength: size,
      ContentType: 'application/octet-stream',
      Metadata: { format: 'CRMBAK01', cipher: 'AES-256-GCM' },
    }),
  );
  const uploaded = await client.send(
    new HeadObjectCommand({ Bucket, Key: objectKey }),
  );
  if (uploaded.ContentLength !== size)
    throw new Error('Uploaded backup size differs.');
  console.log(
    JSON.stringify({
      status: 'BACKUP_OK',
      key: objectKey,
      bytes: size,
      encrypted: true,
    }),
  );
} catch {
  // AWS/PostgreSQL exceptions can contain endpoints or credentials.
  console.error(
    'Backup failed. Check private database/bucket access and the backup key.',
  );
  process.exitCode = 1;
} finally {
  child?.kill('SIGTERM');
  client?.destroy();
  clearTimeout(deadline);
  if (directory) await rm(directory, { recursive: true, force: true });
}
