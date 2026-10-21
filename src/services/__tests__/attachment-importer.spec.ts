import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreApiClient } from 'twenty-client-sdk/core';
const store = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
vi.mock('twenty-sdk/logic-function', () => ({ kv: store }));
import { AttachmentImporter } from '../attachment-importer';
const query = vi.fn(); const mutation = vi.fn(); const uploadFile = vi.fn(); const fetcher = vi.fn<typeof fetch>();
const client = { query, mutation, uploadFile } as unknown as CoreApiClient;
beforeEach(() => { vi.clearAllMocks(); query.mockResolvedValue({ attachments: { edges: [] } }); store.get.mockResolvedValue(null); uploadFile.mockResolvedValue({ id: 'uploaded' }); });
describe('AttachmentImporter', () => {
  it.each(['http://localhost/file', 'https://127.0.0.1/file', 'https://evil.test/file', 'https://foo.amazonaws.com:443/file'])('rejects unsafe download URLs %s', async url => { if (url.endsWith(':443/file')) url = 'https://foo.amazonaws.com:444/file'; await expect(new AttachmentImporter(client, fetcher).import({ url, size: 1 }, 'id', 'deal')).rejects.toThrow('host'); expect(fetcher).not.toHaveBeenCalled(); });
  it('copies and links native files without forwarding RD auth', async () => { fetcher.mockResolvedValue(new Response('data')); expect(await new AttachmentImporter(client, fetcher).import({ url: 'https://bucket.s3.amazonaws.com/file?signature=x', name: 'test.txt', size: 4 }, 'id', 'deal')).toBe(true); expect(fetcher.mock.calls[0][1]).not.toHaveProperty('headers'); expect(uploadFile.mock.calls[0][0].fileBuffer.toString()).toBe('data'); expect(mutation.mock.calls[0][0]).toMatchObject({ createAttachment: { __args: { data: { id: 'id', targetOpportunityId: 'deal', file: [{ fileId: 'uploaded', label: 'test.txt' }] } } } }); });
  it('resumes after upload without copying the binary a second time', async () => { store.get.mockResolvedValue({ id: 'uploaded' }); await new AttachmentImporter(client, fetcher).import({ name: 'test.txt' }, 'id', 'deal'); expect(fetcher).not.toHaveBeenCalled(); expect(uploadFile).not.toHaveBeenCalled(); expect(mutation).toHaveBeenCalled(); });
  it('rejects truncated downloads before uploading', async () => { fetcher.mockResolvedValue(new Response('short')); await expect(new AttachmentImporter(client, fetcher).import({ url: 'https://bucket.s3.amazonaws.com/file', name: 'file', size: 10 }, 'id', 'deal')).rejects.toThrow('incomplete'); expect(uploadFile).not.toHaveBeenCalled(); });
});
