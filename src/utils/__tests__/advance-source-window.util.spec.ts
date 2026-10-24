import { expect, it } from 'vitest';
import { advanceSourceWindow } from '../advance-source-window.util';
import type { ImportSelection } from 'src/types/import-selection';
const selection = (): ImportSelection => ({
  scope: 'all',
  cutoff: '2026-10-24T00:00:00Z',
  limit: 25,
  selectedDeals: [],
});
it('advances before 10,000 records with inclusive timestamp overlap', () => {
  const state = selection();
  const rows = [
    { created_at: '2026-10-23T00:00:00Z' },
    { created_at: '2026-10-20T00:00:00Z' },
  ];
  expect(advanceSourceWindow(state, rows, 398, true)).toBe(false);
  expect(advanceSourceWindow(state, rows, 399, true)).toBe(true);
  expect(state.upper).toBe('2026-10-20T00:00:00Z');
});
it('does not advance a completed list', () =>
  expect(advanceSourceWindow(selection(), [], 399, false)).toBe(false));
it('fails closed when a dense timestamp cannot advance rather than skipping tied records', () => {
  const state = selection();
  state.upper = '2026-10-20T00:00:00Z';
  expect(() =>
    advanceSourceWindow(state, [{ created_at: state.upper }], 399, true),
  ).toThrow('RD_DENSE_TIMESTAMP_LIMIT');
});
it.each([
  [{ created_at: 'invalid' }],
  [{ created_at: '2027-01-01T00:00:00Z' }],
  [
    { created_at: '2026-10-20T00:00:00Z' },
    { created_at: '2026-10-23T00:00:00Z' },
  ],
])(
  'rejects malformed, future or incorrectly ordered source dates',
  (...records) => {
    expect(() => advanceSourceWindow(selection(), records, 1, true)).toThrow(
      'RD_SOURCE_ORDER_CHANGED',
    );
  },
);
it('reads beyond 10,000 synthetic records without losing timestamp ties and keeps first creation order newest first', () => {
      const state = selection();
      const source = Array.from({ length: 10_150 }, (_, index) => ({
        id: String(index),
        created_at: new Date(
          Date.UTC(2026, 9, 23) - Math.floor(index / 4) * 1000,
        ).toISOString(),
      }));
      const seen = new Set<string>();
      const firstSeen: string[] = [];
      let page = 1;
      for (let request = 0; request < 500; request += 1) {
        const filtered = source.filter(
          (record) =>
            Date.parse(record.created_at) <=
            Date.parse(state.upper ?? state.cutoff),
        );
        const batch = filtered.slice((page - 1) * 25, page * 25);
        for (const record of batch)
          if (!seen.has(record.id)) {
            seen.add(record.id);
            firstSeen.push(record.id);
          }
        const more = filtered.length > page * 25;
        if (advanceSourceWindow(state, batch, page, more)) page = 1;
        else if (more) page += 1;
        else break;
      }
      expect(seen.size).toBe(source.length);
      expect(firstSeen).toEqual(source.map((record) => record.id));
});
