import { describe, expect, it } from 'vitest';

import { rowLayout } from './rowLayout.ts';

describe('rowLayout', () => {
  it('keeps the design row at the default text size', () => {
    expect(rowLayout(1)).toEqual({
      titleLines: 1,
      factsLines: 1,
      badgesUnderText: false,
    });
  });

  it('bounds the row and gives the words the badge column once text grows', () => {
    for (const fontScale of [1.3, 2]) {
      expect(rowLayout(fontScale)).toEqual({
        titleLines: 3,
        factsLines: 2,
        badgesUnderText: true,
      });
    }
  });
});
