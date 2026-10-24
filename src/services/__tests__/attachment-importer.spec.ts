import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreApiClient } from 'twenty-client-sdk/core';
const store = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
vi.mock('twenty-sdk/logic-function', () => ({ kv: store }));
import { AttachmentImporter } from '../attachment-importer';
const query = vi.fn();
const mutation = vi.fn();
const uploadFile = vi.fn();
const fetcher = vi.fn<typeof fetch>();
const client = { query, mutation, uploadFile } as unknown as CoreApiClient;
const metadataMutation = vi.fn();
const uploader = vi.fn<typeof fetch>();
const build = () =>
  new AttachmentImporter(
    client,
    fetcher,
    store,
    {
      mutation: metadataMutation,
    } as unknown as import('twenty-client-sdk/metadata').MetadataApiClient,
    uploader,
  );
beforeEach(() => {
  vi.clearAllMocks();
  query.mockResolvedValue({ attachments: { edges: [] } });
  store.get.mockResolvedValue(null);
  uploadFile.mockResolvedValue({ id: 'uploaded' });
  metadataMutation.mockImplementation(async (request) =>
    request.createFileUpload
      ? {
          createFileUpload: {
            fileId: 'uploaded',
            uploadUrl: 'https://twenty.test/upload',
            contentType: 'text/plain',
          },
        }
      : { completeFileUpload: { id: 'uploaded' } },
  );
  uploader.mockResolvedValue(new Response('{}'));
});
describe('AttachmentImporter', () => {
  it('skips an existing attachment before downloading or uploading another copy', async () => {
    query.mockResolvedValue({
      attachments: { edges: [{ node: { id: 'existing-file' } }] },
    });
    expect(
      await build().import({ name: 'Same file' }, 'existing-file', 'deal'),
    ).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
    expect(uploader).not.toHaveBeenCalled();
    expect(metadataMutation).not.toHaveBeenCalled();
    expect(mutation).not.toHaveBeenCalled();
  });
  it.each([
    'http://localhost/file',
    'https://127.0.0.1/file',
    'https://evil.test/file',
    'https://foo.amazonaws.com:443/file',
  ])('rejects unsafe download URLs %s', async (url) => {
    if (url.endsWith(':443/file')) url = 'https://foo.amazonaws.com:444/file';
    await expect(
      build().import({ url, size: 1 }, 'id', 'deal'),
    ).rejects.toThrow('host');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('copies and links native files without forwarding RD auth', async () => {
    fetcher.mockResolvedValue(new Response('data'));
    expect(
      await build().import(
        {
          url: 'https://bucket.s3.amazonaws.com/file?signature=x',
          name: 'test.txt',
          size: 4,
        },
        'id',
        'deal',
      ),
    ).toBe(true);
    expect(fetcher.mock.calls[0][1]).not.toHaveProperty('headers');
    expect(fetcher.mock.calls[0][1]?.method).toBe('GET');
    expect(
      Buffer.from(uploader.mock.calls[0][1]?.body as Uint8Array).toString(),
    ).toBe('data');
    expect(metadataMutation.mock.calls[0][0]).toHaveProperty(
      'createFileUpload',
    );
    expect(mutation.mock.calls[0][0]).toMatchObject({
      createAttachment: {
        __args: {
          data: {
            id: 'id',
            targetOpportunityId: 'deal',
            file: [{ fileId: 'uploaded', label: 'test.txt' }],
          },
        },
      },
    });
  });
  it('resumes after upload without copying the binary a second time', async () => {
    store.get.mockResolvedValue({ id: 'uploaded' });
    await build().import({ name: 'test.txt' }, 'id', 'deal');
    expect(fetcher).not.toHaveBeenCalled();
    expect(uploadFile).not.toHaveBeenCalled();
    expect(mutation).toHaveBeenCalled();
  });
  it('rejects truncated downloads before uploading', async () => {
    fetcher.mockResolvedValue(new Response('short'));
    await expect(
      build().import(
        { url: 'https://bucket.s3.amazonaws.com/file', name: 'file', size: 10 },
        'id',
        'deal',
      ),
    ).rejects.toThrow('incomplete');
    expect(uploadFile).not.toHaveBeenCalled();
  });
  it.each([
    'https://api.rd.services/crm/v2/deals',
    'https://crm.rdstation.com/api/v1/deals',
    'https://api.rd.services/oauth2/token',
  ])(
    'cannot PUT an attachment to RD even if upload metadata points there: %s',
    async (url) => {
      fetcher.mockResolvedValue(new Response('data'));
      metadataMutation.mockResolvedValue({
        createFileUpload: {
          fileId: 'file',
          uploadUrl: url,
          contentType: 'text/plain',
        },
      });
      await expect(
        build().import(
          { url: 'https://bucket.s3.amazonaws.com/file', size: 4 },
          'id',
          'deal',
        ),
      ).rejects.toThrow('RD_READ_ONLY_POLICY');
      expect(uploader).not.toHaveBeenCalled();
      expect(mutation).not.toHaveBeenCalled();
    },
  );
});
