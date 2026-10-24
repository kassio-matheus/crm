import { expect, it } from 'vitest';
import { importDuration } from '../import-duration.util';
it('formats seconds, minutes and hours without false precision', () => {
  expect(importDuration(59)).toBe('59s');
  expect(importDuration(75)).toBe('1min 15s');
  expect(importDuration(3670)).toBe('1h 1min');
  expect(importDuration(-1)).toBe('—');
  expect(importDuration(NaN)).toBe('—');
});
