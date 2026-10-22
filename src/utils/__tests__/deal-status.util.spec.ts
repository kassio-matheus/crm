import { describe, expect, it } from 'vitest';
import { dealStatus } from '../deal-status.util';
describe('dealStatus', () => {
  it.each([
    [{}, 'ONGOING'],
    [{ win: null }, 'ONGOING'],
    [{ win: true, hold: true }, 'WON'],
    [{ win: false, hold: true }, 'LOST'],
    [{ hold: true }, 'PAUSED'],
    [{ status: 'won' }, 'WON'],
    [{ status: 'lost' }, 'LOST'],
    [{ status: 'paused' }, 'PAUSED'],
    [{ status: 'ongoing' }, 'ONGOING'],
  ])('maps %j to %s', (input, output) =>
    expect(dealStatus(input as Record<string, unknown>)).toBe(output),
  );
  it('rejects unfamiliar statuses instead of guessing', () =>
    expect(() => dealStatus({ status: 'deleted' })).toThrow('Unsupported'));
});
