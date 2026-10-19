import { describe, expect, it } from 'vitest';
import { normalizeWa } from './wa.js';

describe('normalizeWa', () => {
  it.each([
    ['081234567890', '6281234567890'],
    ['6281234567890', '6281234567890'],
    ['+62 812-3456-7890', '6281234567890'],
    ['(0812) 3456.7890', '6281234567890'],
    ['81234567890', '6281234567890'],
    ['  0812 3456 789  ', '628123456789'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeWa(input)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    '',
    '   ',
    'abc',
    '0812abc4567',
    '021123456',
    '0812345',
    '62812345678901234',
  ])('menolak %s', (input) => {
    expect(normalizeWa(input)).toBeNull();
  });
});
