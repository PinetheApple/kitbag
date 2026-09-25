import { describe, expect, it } from 'vitest';

import { textRoles } from './roles.ts';
import { textStyle } from './textStyle.ts';
import { buildTheme, mixHex, themes } from './theme.ts';
import { COLOR_TOKENS, palette } from './tokens.ts';

describe('mixHex', () => {
  it('returns either input at the ends of the range', () => {
    expect(mixHex('#FFB347', '#242230', 1)).toBe('#FFB347');
    expect(mixHex('#FFB347', '#242230', 0)).toBe('#242230');
  });

  it('blends each channel linearly like CSS color-mix in srgb', () => {
    expect(mixHex('#FFFFFF', '#000000', 0.5)).toBe('#808080');
  });
});

describe('themes', () => {
  it('resolves every token from the palette for both modes', () => {
    for (const mode of ['dark', 'light'] as const) {
      for (const token of COLOR_TOKENS) {
        expect(themes[mode].color[token]).toBe(palette[token][mode]);
      }
    }
  });

  it('derives tints from tokens rather than holding its own hex', () => {
    const dark = buildTheme('dark');
    expect(dark.activeControlFill).toBe(
      mixHex(palette.accent.dark, palette.surface2.dark, 0.18),
    );
    expect(dark.feedback.warning.fg).toBe(palette.amber.dark);
    expect(buildTheme('light').feedback.danger.fg).toBe(palette.red.light);
  });
});

const LINEAR_THRESHOLD = 0.03928;
const LINEAR_DIVISOR = 12.92;
const GAMMA_OFFSET = 0.055;
const GAMMA_SCALE = 1.055;
const GAMMA = 2.4;
const LUMA = [0.2126, 0.7152, 0.0722];
const CONTRAST_OFFSET = 0.05;
const AA_TEXT = 4.5;

function luminance(hex: string): number {
  return [1, 3, 5].reduce((sum, offset, i) => {
    const c = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    const linear =
      c <= LINEAR_THRESHOLD
        ? c / LINEAR_DIVISOR
        : ((c + GAMMA_OFFSET) / GAMMA_SCALE) ** GAMMA;
    return sum + linear * (LUMA[i] ?? 0);
  }, 0);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + CONTRAST_OFFSET) / ((lo ?? 0) + CONTRAST_OFFSET);
}

describe('onDanger', () => {
  it('reads at AA text contrast on the danger fill in both modes', () => {
    for (const mode of ['dark', 'light'] as const) {
      const theme = themes[mode];
      expect(
        contrast(theme.onDanger, theme.feedback.danger.fg),
      ).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });
});

describe('textStyle', () => {
  it('turns em tracking into dp and marks tabular figures', () => {
    const style = textStyle(textRoles.badge);
    expect(style.letterSpacing).toBeCloseTo(10.5 * 0.06);
    expect(textStyle(textRoles.preset).fontVariant).toEqual(['tabular-nums']);
    expect(textStyle(textRoles.chip).fontVariant).toBeUndefined();
  });
});
