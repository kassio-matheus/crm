import { describe, expect, it } from 'vitest';
import { rdCallbackUrl } from '../rd-callback-url.util';
describe('RD callback origin', () => {
  it('derives one fixed callback path from the deployed server origin', () => {
    expect(rdCallbackUrl('https://crm.example.test/metadata')).toBe(
      'https://crm.example.test/s/rd-station/oauth/callback',
    );
  });
  it.each([
    'http://crm.example.test',
    'https://user:secret@crm.example.test',
    'https://crm.example.test?next=evil',
    'javascript:alert(1)',
  ])('rejects unsafe origin %s', (origin) => {
    expect(() => rdCallbackUrl(origin)).toThrow(
      'RD_OAUTH_CALLBACK_CONFIGURATION_REQUIRED',
    );
  });
  it('permits explicit localhost for isolated development', () => {
    expect(rdCallbackUrl('http://localhost:2021')).toBe(
      'http://localhost:2021/s/rd-station/oauth/callback',
    );
  });
});
