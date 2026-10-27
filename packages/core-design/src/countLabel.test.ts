import { describe, expect, it } from 'vitest';

import { countLabel } from './countLabel.ts';

describe('countLabel', () => {
  it.each([
    [0, '0 songs'],
    [1, '1 song'],
    [2, '2 songs'],
  ])('%s reads %s', (count, expected) => {
    expect(countLabel(count, 'song', 'songs')).toBe(expected);
  });
});
