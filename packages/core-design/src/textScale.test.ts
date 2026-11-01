import { describe, expect, it } from 'vitest';

import { iconSizes, screenBar } from './roles.ts';
import {
  grownTextScale,
  isTextScaled,
  lineLimit,
  textIconScale,
  UNLIMITED_LINES,
} from './textScale.ts';

describe('grownTextScale', () => {
  it('never shrinks a size below its design value', () => {
    expect(grownTextScale(0.85)).toBe(1);
    expect(grownTextScale(1)).toBe(1);
  });

  it('follows the system scale above the default', () => {
    expect(grownTextScale(1.3)).toBe(1.3);
    expect(grownTextScale(2)).toBe(2);
  });
});

describe('isTextScaled', () => {
  it('is false at the default scale and below, true above it', () => {
    expect(isTextScaled(0.85)).toBe(false);
    expect(isTextScaled(1)).toBe(false);
    expect(isTextScaled(1.15)).toBe(true);
  });
});

describe('lineLimit', () => {
  it('keeps the designed line count at the default scale and below', () => {
    expect(lineLimit(1, 1)).toBe(1);
    expect(lineLimit(0.85, 2)).toBe(2);
  });

  it('lets text wrap freely once the system scale grows it', () => {
    expect(lineLimit(1.15, 1)).toBe(UNLIMITED_LINES);
    expect(lineLimit(2, 1)).toBe(UNLIMITED_LINES);
  });
});

describe('textIconScale', () => {
  it('draws icons at their design size at the default scale', () => {
    expect(textIconScale(1)).toBe(1);
    expect(textIconScale(0.85)).toBe(1);
  });

  it('grows icons with the text up to the cap', () => {
    expect(textIconScale(1.3)).toBe(1.3);
    expect(textIconScale(2)).toBeLessThan(2);
  });

  it('keeps every bar glyph inside its 48 dp button at 200%', () => {
    for (const glyph of [iconSizes.bar, iconSizes.skip]) {
      expect(glyph * textIconScale(2)).toBeLessThan(screenBar.iconButton);
    }
  });
});
