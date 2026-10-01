import { describe, expect, it } from 'vitest';

import { pickerRows } from './pickerRows.ts';

describe('pickerRows', () => {
  it('puts four count-in choices on one row', () => {
    expect(pickerRows(['0', '1', '2', '4'], 4)).toEqual([['0', '1', '2', '4']]);
  });

  it('splits six sounds into two rows of three', () => {
    expect(pickerRows(['a', 'b', 'c', 'd', 'e', 'f'], 3)).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ]);
  });

  it('pads a short last row so columns stay aligned', () => {
    expect(pickerRows(['a', 'b', 'c', 'd'], 3)).toEqual([
      ['a', 'b', 'c'],
      ['d', undefined, undefined],
    ]);
  });
});
