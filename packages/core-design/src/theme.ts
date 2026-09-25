import { mix } from './roles.ts';
import {
  resolveTheme,
  shadow,
  type ColorToken,
  type ThemeMode,
} from './tokens.ts';

const HEX_RADIX = 16;
const CHANNEL_MAX = 255;
const HEX_PAIR = 2;
const CHANNEL_OFFSET = { red: 1, green: 3, blue: 5 } as const;

function channels(hex: string): readonly number[] {
  return Object.values(CHANNEL_OFFSET).map((offset) =>
    Number.parseInt(hex.slice(offset, offset + HEX_PAIR), HEX_RADIX),
  );
}

export function mixHex(fg: string, bg: string, fgWeight: number): string {
  const top = channels(fg);
  const bottom = channels(bg);
  const mixed = top.map((value, i) => {
    const blended = value * fgWeight + (bottom[i] ?? 0) * (1 - fgWeight);
    return Math.min(CHANNEL_MAX, Math.round(blended))
      .toString(HEX_RADIX)
      .padStart(HEX_PAIR, '0');
  });
  return `#${mixed.join('').toUpperCase()}`;
}

export type FeedbackTone = 'success' | 'warning' | 'danger';

export interface FeedbackColors {
  readonly fg: string;
  readonly badgeBorder: string;
  readonly cardBorder: string;
}

export interface Theme {
  readonly mode: ThemeMode;
  readonly color: Readonly<Record<ColorToken, string>>;
  readonly activeControlFill: string;
  readonly activeCardFill: string;
  readonly onDanger: string;
  readonly feedback: Readonly<Record<FeedbackTone, FeedbackColors>>;
  readonly shadow: string;
}

const FEEDBACK_TOKEN: Readonly<Record<FeedbackTone, ColorToken>> = {
  success: 'green',
  warning: 'amber',
  danger: 'red',
};

function feedbackColors(
  color: Readonly<Record<ColorToken, string>>,
  tone: FeedbackTone,
): FeedbackColors {
  const fg = color[FEEDBACK_TOKEN[tone]];
  return {
    fg,
    badgeBorder: mixHex(fg, color.line, mix.badgeBorder),
    cardBorder: mixHex(fg, color.line, mix.cardBorder),
  };
}

export function buildTheme(mode: ThemeMode): Theme {
  const color = resolveTheme(mode);
  return {
    mode,
    color,
    activeControlFill: mixHex(color.accent, color.surface2, mix.activeControl),
    activeCardFill: mixHex(color.accent, color.surface1, mix.activeCard),
    onDanger: color.surface1,
    feedback: {
      success: feedbackColors(color, 'success'),
      warning: feedbackColors(color, 'warning'),
      danger: feedbackColors(color, 'danger'),
    },
    shadow: shadow.sheet[mode],
  };
}

export const themes: Readonly<Record<ThemeMode, Theme>> = {
  dark: buildTheme('dark'),
  light: buildTheme('light'),
};
