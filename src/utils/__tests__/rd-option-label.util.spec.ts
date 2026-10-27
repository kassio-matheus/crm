import { expect, it } from 'vitest';
import { rdOptionLabel } from '../rd-option-label.util';

it('keeps valid labels and converts commas to readable semicolons', () => {
  expect(rdOptionLabel('Não.')).toBe('Não.');
  expect(rdOptionLabel('Sim, tenho delivery.')).toBe('Sim; tenho delivery.');
  expect(rdOptionLabel('A, B, C')).toBe('A; B; C');
});

it('bounds long labels and distinguishes identical truncated prefixes', () => {
  const prefix = 'Resposta longa '.repeat(8);
  const first = rdOptionLabel(`${prefix}A`);
  expect(first.length).toBeLessThanOrEqual(63);
  expect(first).not.toBe(rdOptionLabel(`${prefix}B`));
  expect(first).toBe(rdOptionLabel(`${prefix}A`));
});

it('handles empty labels and Unicode without cutting surrogate pairs', () => {
  for (const label of ['', ' ', '😀'.repeat(40)]) {
    const result = rdOptionLabel(label);
    expect(result.trim().length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(63);
    expect(result).not.toContain(',');
    expect(
      Array.from(result).every((character) => {
        const code = character.charCodeAt(0);
        return character.length === 2 || code < 0xd800 || code > 0xdfff;
      }),
    ).toBe(true);
  }
});
