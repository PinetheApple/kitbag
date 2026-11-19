import { describe, expect, it } from 'vitest';

import { formatBytes, formatWithGbDecimal } from './bytes.ts';

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [999, '999 B'],
    [1000, '1.0 KB'],
    [1_200_000, '1.2 MB'],
    [9_960_000, '10 MB'],
    [320_000_000, '320 MB'],
    [840_400_000, '840 MB'],
    [999_600, '1.0 MB'],
    [1_160_000_000, '1.2 GB'],
    [12_000_000_000_000, '12000 GB'],
  ])('%d bytes reads %s', (bytes, text) => {
    expect(formatBytes(bytes)).toBe(text);
  });
});

describe('formatWithGbDecimal', () => {
  it.each([
    [640_000_000, '640 MB'],
    [1_200_000_000, '1.2 GB'],
    [41_230_000_000, '41.2 GB'],
    [128_000_000_000, '128.0 GB'],
  ])('%d bytes reads %s', (bytes, text) => {
    expect(formatWithGbDecimal(bytes)).toBe(text);
  });
});
