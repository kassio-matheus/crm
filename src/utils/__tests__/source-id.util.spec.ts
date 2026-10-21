import { describe, expect, it } from 'vitest';
import { sourceId } from '../source-id.util';
describe('sourceId', () => {
  it('produces stable valid UUIDs independent of retries', () => { expect(sourceId('company:1')).toBe(sourceId('company:1')); expect(sourceId('company:1')).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/); });
  it('separates tenants, kinds and archive namespaces', () => { expect(new Set(['a:deals:1', 'b:deals:1', 'a:contacts:1', 'archive:a:deals:1'].map(sourceId)).size).toBe(4); });
});
