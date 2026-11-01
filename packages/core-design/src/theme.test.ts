import { describe, expect, it } from 'vitest';

import { textRoles } from './roles.ts';
import { textStyle } from './textStyle.ts';
import { buildTheme, mixHex, themes, type Theme } from './theme.ts';
import { COLOR_TOKENS, palette, type ThemeMode } from './tokens.ts';

const MODES: readonly ThemeMode[] = ['dark', 'light'];

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
    for (const mode of MODES) {
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
    for (const mode of MODES) {
      const theme = themes[mode];
      expect(
        contrast(theme.onDanger, theme.feedback.danger.fg),
      ).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });
});

describe('disabledLabel', () => {
  it('reads at AA text contrast on a sheet and on the screen in both modes', () => {
    for (const mode of MODES) {
      const theme = themes[mode];
      for (const ground of [theme.color.surface1, theme.color.bg]) {
        expect(contrast(theme.disabledLabel, ground)).toBeGreaterThanOrEqual(
          AA_TEXT,
        );
      }
    }
  });
});

const AA_NON_TEXT = 3;

type Grounds = (theme: Theme) => Record<string, string>;

interface InkOnGrounds {
  readonly ink: (theme: Theme) => string;
  readonly grounds: Grounds;
}

const surfaces: Grounds = ({ color }) => ({
  bg: color.bg,
  surface1: color.surface1,
  surface2: color.surface2,
  surface3: color.surface3,
});

const tintedFills: Grounds = (theme) => ({
  activeControlFill: theme.activeControlFill,
  activeCardFill: theme.activeCardFill,
  songNowFill: theme.songNowFill,
  setChipFill: theme.setChipFill,
  selectedTileFill: theme.selectedTileFill,
});

const allGrounds: Grounds = (theme) => ({
  ...surfaces(theme),
  ...tintedFills(theme),
});

const restingGrounds: Grounds = (theme) => ({
  bg: theme.color.bg,
  surface1: theme.color.surface1,
  surface2: theme.color.surface2,
  activeCardFill: theme.activeCardFill,
  songNowFill: theme.songNowFill,
});

const accentInk = (theme: Theme) => theme.color[theme.accentInk];

const SMALL_TEXT: Readonly<Record<string, InkOnGrounds>> = {
  text: { ink: ({ color }) => color.text, grounds: allGrounds },
  text2: { ink: ({ color }) => color.text2, grounds: allGrounds },
  accentInk: { ink: accentInk, grounds: allGrounds },
  text3: { ink: ({ color }) => color.text3, grounds: restingGrounds },
};

const ICONS: Readonly<Record<string, InkOnGrounds>> = {
  accent: { ink: ({ color }) => color.accent, grounds: surfaces },
  accentInk: { ink: accentInk, grounds: tintedFills },
};

function contrastCases(table: Readonly<Record<string, InkOnGrounds>>) {
  return MODES.flatMap((mode) =>
    Object.entries(table).flatMap(([name, { ink, grounds }]) =>
      Object.entries(grounds(themes[mode])).map(
        ([ground, hex]) =>
          [mode, name, ground, contrast(ink(themes[mode]), hex)] as const,
      ),
    ),
  );
}

describe('small text', () => {
  it.each(contrastCases(SMALL_TEXT))(
    'reads at AA text contrast in %s: %s on %s',
    (_mode, _ink, _ground, ratio) => {
      expect(ratio).toBeGreaterThanOrEqual(AA_TEXT);
    },
  );

  it.each(MODES)('keeps text above text2 above text3 in %s', (mode) => {
    const { color } = themes[mode];
    const onBg = (hex: string) => contrast(hex, color.bg);
    expect(onBg(color.text)).toBeGreaterThan(onBg(color.text2));
    expect(onBg(color.text2)).toBeGreaterThan(onBg(color.text3));
  });
});

describe('icons', () => {
  it.each(contrastCases(ICONS))(
    'reads at AA non-text contrast in %s: %s on %s',
    (_mode, _ink, _ground, ratio) => {
      expect(ratio).toBeGreaterThanOrEqual(AA_NON_TEXT);
    },
  );
});

describe('textStyle', () => {
  it('turns em tracking into dp and marks tabular figures', () => {
    const style = textStyle(textRoles.badge);
    expect(style.letterSpacing).toBeCloseTo(10.5 * 0.06);
    expect(textStyle(textRoles.preset).fontVariant).toEqual(['tabular-nums']);
    expect(textStyle(textRoles.chip).fontVariant).toBeUndefined();
  });
});
