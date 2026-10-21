import { Buffer } from 'node:buffer';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { kv } from 'twenty-sdk/logic-function';
import { STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

/** Copies signed RD file downloads into native Twenty attachments without forwarding RD credentials. */
export class AttachmentImporter {
  constructor(private client = new CoreApiClient(), private fetcher: typeof fetch = fetch) {}

  async import(record: Record<string, unknown>, id: string, targetOpportunityId: string): Promise<boolean> {
    const existing = await this.client.query({ attachments: { __args: { first: 1, filter: { id: { eq: id } } }, edges: { node: { id: true } } } });
    if (existing.attachments!.edges.length) return false;
    let uploaded = await kv.get<{ id: string }>(`rd:uploaded:${id}`);
    const name = typeof record.name === 'string' && record.name ? record.name : 'RD attachment';
    if (!uploaded) {
      if (typeof record.url !== 'string') throw new Error('Invalid source attachment URL.');
      const url = new URL(record.url);
      // RD returns a temporary storage URL. Private/unknown hosts and redirects are refused.
      if (url.protocol !== 'https:' || url.port || url.username || url.password || !['.amazonaws.com', '.cloudfront.net', '.rdstation.com', '.rd.services'].some(domain => url.hostname.endsWith(domain))) throw new Error('Invalid source attachment host.');
      const maximumBytes = 50 * 1024 * 1024;
      if (typeof record.size !== 'number' || record.size < 0 || record.size > maximumBytes) throw new Error('Invalid source attachment size (maximum 50 MB per file).');
      let response: Response;
      try { response = await this.fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(60_000) }); } catch { throw new Error('RD_CONNECTION_FAILED'); }
      if (!response.ok || !response.body) throw new Error('RD_ATTACHMENT_DOWNLOAD_FAILED');
      const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
      for (;;) {
        const chunk = await reader.read(); if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > maximumBytes) { await reader.cancel(); throw new Error('Invalid source attachment size.'); }
        chunks.push(chunk.value);
      }
      if (size !== record.size) throw new Error('Invalid source attachment size; download was incomplete.');
      const file = await this.client.uploadFile({ fileBuffer: Buffer.concat(chunks), filename: name, fieldMetadataUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.attachment.fields.file.universalIdentifier });
      uploaded = { id: file.id };
      await kv.set(`rd:uploaded:${id}`, uploaded);
    }
    await this.client.mutation({ createAttachment: { __args: { data: { id, name, file: [{ fileId: uploaded.id, label: name }], targetOpportunityId } }, id: true } });
    return true;
  }
}
