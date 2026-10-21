import { describe, expect, it } from 'vitest';
import { mapRdRecord } from '../map-rd-record.util';
describe('mapRdRecord', () => {
  it('converts money to exact micros and preserves custom source fields', () => {
    const result = mapRdRecord(
      'deals',
      {
        id: '1',
        name: 'Sale',
        amount_total: 399.83,
        win: null,
        deal_stage: { id: 'stage', deal_pipeline_id: 'pipe' },
        user: { id: 'u', name: 'Ana' },
        custom: 'kept',
      },
      'acme:deals:1',
    );
    expect(result).toMatchObject({
      amount: { amountMicros: '399830000', currencyCode: 'BRL' },
      dealStatus: 'ONGOING',
      salesStageKey: 'stage',
      salesPipelineKey: 'pipe',
      rdOwnerName: 'Ana',
      rdOriginalData: { custom: 'kept' },
    });
  });
  it('maps the v2 deal schema', () =>
    expect(
      mapRdRecord(
        'deals',
        {
          status: 'paused',
          pipeline_id: 'p',
          stage_id: 's',
          owner_id: 'u',
          total_price: 0,
        },
        'key',
      ),
    ).toMatchObject({
      dealStatus: 'PAUSED',
      salesPipelineKey: 'p',
      salesStageKey: 's',
      rdOwnerId: 'u',
    }));
  it.each([NaN, Infinity, '10', 9e30])('rejects invalid money %s', (amount) =>
    expect(() => mapRdRecord('deals', { amount_total: amount }, 'key')).toThrow(
      'amount',
    ),
  );
  it('rejects invalid dates before any writes', () =>
    expect(() =>
      mapRdRecord('deals', { prediction_date: 'bad' }, 'key'),
    ).toThrow('date'));
  it('maps multiple contact emails and phone numbers without discarding originals', () =>
    expect(
      mapRdRecord(
        'contacts',
        {
          name: 'Maria da Silva',
          emails: [{ email: 'a@b.co' }, { email: 'b@b.co' }],
          phones: [{ phone: '+5569999' }],
        },
        'key',
      ),
    ).toMatchObject({
      name: { firstName: 'Maria', lastName: 'da Silva' },
      emails: { primaryEmail: 'a@b.co', additionalEmails: ['b@b.co'] },
      phones: { primaryPhoneNumber: '+5569999' },
    }));
  it('includes completed tasks', () =>
    expect(
      mapRdRecord('tasks', { subject: 'Call', done: true }, 'key'),
    ).toMatchObject({ title: 'Call', status: 'DONE' }));
  it('does not turn archived catalogs into native objects', () =>
    expect(mapRdRecord('products', { name: 'Product' }, 'key')).toEqual({}));
});

describe('source contact activity date', () => {
  it('retains the documented RD v1 last activity timestamp for contact ordering', () =>
    expect(
      mapRdRecord(
        'deals',
        { last_activity_at: '2026-10-21T09:00:00-03:00' },
        'key',
      ).lastContactAt,
    ).toBe('2026-10-21T12:00:00.000Z'));
});

describe('source task clock time', () => {
  it('combines the v1 midnight date and separate clock time without losing the timezone', () =>
    expect(
      mapRdRecord(
        'tasks',
        { date: '2026-10-21T03:00:00.000Z', hour: '14:30' },
        'key',
      ).dueAt,
    ).toBe('2026-10-21T17:30:00.000Z'));
  it('rejects an invalid source clock time before writes', () =>
    expect(() =>
      mapRdRecord(
        'tasks',
        { date: '2026-10-21T03:00:00.000Z', hour: '25:30' },
        'key',
      ),
    ).toThrow('hour'));
});
