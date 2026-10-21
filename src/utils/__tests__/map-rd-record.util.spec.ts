import { describe, expect, it } from 'vitest';
import { mapRdRecord } from '../map-rd-record.util';
describe('mapRdRecord', () => {
  it('converts money to exact micros and preserves custom source fields', () => { const result = mapRdRecord('deals', { id: '1', name: 'Sale', amount_total: 399.83, win: null, deal_stage: { id: 'stage', deal_pipeline_id: 'pipe' }, user: { id: 'u', name: 'Ana' }, custom: 'kept' }, 'acme:deals:1'); expect(result).toMatchObject({ amount: { amountMicros: '399830000', currencyCode: 'BRL' }, dealStatus: 'ONGOING', salesStageKey: 'stage', salesPipelineKey: 'pipe', rdOwnerName: 'Ana', rdOriginalData: { custom: 'kept' } }); });
  it('maps the v2 deal schema', () => expect(mapRdRecord('deals', { status: 'paused', pipeline_id: 'p', stage_id: 's', owner_id: 'u', total_price: 0 }, 'key')).toMatchObject({ dealStatus: 'PAUSED', salesPipelineKey: 'p', salesStageKey: 's', rdOwnerId: 'u' }));
  it.each([NaN, Infinity, '10', 9e30])('rejects invalid money %s', amount => expect(() => mapRdRecord('deals', { amount_total: amount }, 'key')).toThrow('amount'));
  it('rejects invalid dates before any writes', () => expect(() => mapRdRecord('deals', { prediction_date: 'bad' }, 'key')).toThrow('date'));
  it('maps multiple contact emails and phone numbers without discarding originals', () => expect(mapRdRecord('contacts', { name: 'Maria da Silva', emails: [{ email: 'a@b.co' }, { email: 'b@b.co' }], phones: [{ phone: '+5569999' }] }, 'key')).toMatchObject({ name: { firstName: 'Maria', lastName: 'da Silva' }, emails: { primaryEmail: 'a@b.co', additionalEmails: ['b@b.co'] }, phones: { primaryPhoneNumber: '+5569999' } }));
  it('includes completed tasks', () => expect(mapRdRecord('tasks', { subject: 'Call', done: true }, 'key')).toMatchObject({ title: 'Call', status: 'DONE' }));
  it('does not turn archived catalogs into native objects', () => expect(mapRdRecord('products', { name: 'Product' }, 'key')).toEqual({}));
});
