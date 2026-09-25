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

describe('textStyle', () => {
  it('turns em tracking into dp and marks tabular figures', () => {
    const style = textStyle(textRoles.badge);
    expect(style.letterSpacing).toBeCloseTo(10.5 * 0.06);
    expect(textStyle(textRoles.preset).fontVariant).toEqual(['tabular-nums']);
    expect(textStyle(textRoles.chip).fontVariant).toBeUndefined();
  });
});
