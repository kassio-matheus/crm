import { describe, expect, it } from 'vitest';
import { rdPaginationUrl } from '../rd-pagination-url.util';

describe('RD pagination destination validation', () => {
  it('normalizes the observed v2 /api/v2 alias onto the documented origin and path', () => {
    const url = rdPaginationUrl('v2', 'organizations',
      'https://api.rd.services/api/v2/organizations?sort[created_at]=asc&page[number]=2&page[size]=25');
    expect(url.origin).toBe('https://api.rd.services');
    expect(url.pathname).toBe('/crm/v2/organizations');
    expect(url.searchParams.get('page[number]')).toBe('2');
    expect(url.searchParams.get('page[size]')).toBe('25');
    expect(url.searchParams.get('sort[created_at]')).toBe('asc');
  });
  it.each([
    '?page[number]=2',
    '/crm/v2/organizations?page[number]=2',
    '/api/v2/organizations?page[number]=2',
    'https://api.rd.services/crm/v2/organizations?page[number]=2',
  ])('accepts a same-resource cursor %s', (next) => {
    const url = rdPaginationUrl('v2', 'organizations', next);
    expect(url.pathname).toBe('/crm/v2/organizations');
    expect(url.searchParams.get('page[number]')).toBe('2');
  });
  it('handles nested stage endpoints and preserves filters', () => {
    const url = rdPaginationUrl('v2', 'pipelines/pipeline/stages',
      '/api/v2/pipelines/pipeline/stages?filter=name:Sales&page[number]=2');
    expect(url.pathname).toBe('/crm/v2/pipelines/pipeline/stages');
    expect(url.searchParams.get('filter')).toBe('name:Sales');
  });
  it('uses the original resource and query when no cursor exists', () => {
    expect(rdPaginationUrl('v1', 'deal_stages?deal_pipeline_id=p').href)
      .toBe('https://crm.rdstation.com/api/v1/deal_stages?deal_pipeline_id=p');
  });
  it.each([
    'https://evil.test/api/v2/organizations?page[number]=2',
    'https://api.rd.services.evil.test/api/v2/organizations',
    '//evil.test/api/v2/organizations',
    'http://api.rd.services/api/v2/organizations',
    'https://api.rd.services:8443/api/v2/organizations',
    'https://user:password@api.rd.services/api/v2/organizations',
    'https://api.rd.services/api/v2/organizations#fragment',
    '/api/v2/contacts?page[number]=2',
    '/crm/v2/deals?page[number]=2',
    '/oauth2/token',
    '/api/v1/organizations',
    '/api/v2/../organizations',
    'https://[invalid',
  ])('rejects an unsafe or different-resource cursor %s', (next) => {
    expect(() => rdPaginationUrl('v2', 'organizations', next)).toThrow('Unsafe');
  });
  it('never applies the v2 alias to v1 requests', () => {
    expect(() => rdPaginationUrl('v1', 'organizations',
      'https://crm.rdstation.com/api/v2/organizations')).toThrow('Unsafe');
  });
  it('canonicalizes query ordering and encoding for repeated-cursor checks', () => {
    expect(rdPaginationUrl('v2', 'organizations',
      '/api/v2/organizations?sort[created_at]=asc&page[number]=2').href)
      .toBe(rdPaginationUrl('v2', 'organizations',
        '/crm/v2/organizations?page%5Bnumber%5D=2&sort%5Bcreated_at%5D=asc').href);
  });
});
