import { stemPlayer } from '@kitbag/core-design';
import { describe, expect, it } from 'vitest';

import { stemNameWidth } from './stemName.ts';

describe('stemNameWidth', () => {
  it('keeps the mockup column at the default text size and below', () => {
    expect(stemNameWidth(1)).toBe(stemPlayer.nameWidth);
    expect(stemNameWidth(0.85)).toBe(stemPlayer.nameWidth);
  });

  it('grows the column with the text above the default', () => {
    expect(stemNameWidth(1.3)).toBeCloseTo(stemPlayer.nameWidth * 1.3);
    expect(stemNameWidth(2)).toBe(stemPlayer.nameWidth * 2);
  });
});
