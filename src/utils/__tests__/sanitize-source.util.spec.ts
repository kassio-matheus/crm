import { describe, expect, it } from 'vitest';
import { sanitizeSource } from '../sanitize-source.util';
describe('sanitizeSource', () => {
  it('removes secrets recursively without losing custom data', () => { expect(sanitizeSource({ token: 'secret', name: 'Client', custom: [{ client_secret: 'bad', password: 'bad', value: 2 }], nested: { Authorization: 'bad', API_KEY: 'bad', access_token: 'bad' } })).toEqual({ name: 'Client', custom: [{ value: 2 }], nested: {} }); });
  it('supports null and scalar values', () => { expect(sanitizeSource(null)).toBeNull(); expect(sanitizeSource('safe')).toBe('safe'); });
});
