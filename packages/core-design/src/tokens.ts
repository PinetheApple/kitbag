// core-design tokens — the sole styling authority (SPEC §12.2, §13.8.1).
//
// This file is the ONE owner of §12.2's palette, type, radii and shadow
// (SPEC §13.7). The Tailwind theme is GENERATED from it by
// `scripts/generate-tailwind.ts`; Skia reads it directly (§13.8.1). A hex
// literal must never be hand-authored anywhere downstream — if it is, it is a
// second source of truth and the §13.7 duplication failure has returned.
//
// Every value below is transcribed verbatim from SPEC §12.2. Dark ("Stage") is
// primary; Light ("Daylight") ships from day one (§12.2, §12.5). Do not add a
// value that is not in §12.2 — "adding a colour means editing §12.2 first".

/** A colour token has one value per theme (SPEC §12.2). */
export interface ColorPair {
  readonly dark: string;
  readonly light: string;
}

/** The §12.2 colour tokens, in table order. */
export const COLOR_TOKENS = [
  'bg',
  'surface1',
  'surface2',
  'surface3',
  'line',
  'text',
  'text2',
  'text3',
  'accent',
  'accentDeep',
  'accentDim',
  'onAccent',
  'red',
  'amber',
  'green',
  'wave',
  'waveHot',
] as const;

export type ColorToken = (typeof COLOR_TOKENS)[number];

/** SPEC §12.2 palette. Dark ("Stage") | Light ("Daylight"). */
export const palette: Readonly<Record<ColorToken, ColorPair>> = {
  bg: { dark: '#0E0D10', light: '#F5F3EE' },
  surface1: { dark: '#1A1820', light: '#FFFFFF' },
  surface2: { dark: '#242230', light: '#ECE9E1' },
  surface3: { dark: '#2E2C3A', light: '#E3DFD4' },
  line: { dark: '#33303F', light: '#DCD7CA' },
  text: { dark: '#ECEAF0', light: '#221F26' },
  text2: { dark: '#9B97A8', light: '#6E687A' },
  text3: { dark: '#6C6878', light: '#98929F' },
  accent: { dark: '#FFB347', light: '#B26F0E' },
  accentDeep: { dark: '#E89B2E', light: '#8F5A0C' },
  accentDim: { dark: '#8A6A35', light: '#D8B27C' },
  onAccent: { dark: '#221600', light: '#FFF7EA' },
  red: { dark: '#FF5C5C', light: '#CC4444' },
  amber: { dark: '#FFC24B', light: '#9A6E06' },
  green: { dark: '#4ADE80', light: '#1E8A4F' },
  wave: { dark: '#4E4A5E', light: '#C9C3B4' },
  waveHot: { dark: '#FFB347', light: '#B26F0E' },
};

// --- Radii (SPEC §12.2) -----------------------------------------------------
// cards 16, tiles 16, chips 99 (pill), buttons 12, sheets 20/20/14/14, LEDs 50%.
// The sheet radius is asymmetric: top corners 20, bottom corners 14. LEDs are
// full circles, so their radius is half the box — a percentage, not a px value.

export const radii = {
  card: 16,
  tile: 16,
  chip: 99,
  button: 12,
  sheetTop: 20,
  sheetBottom: 14,
} as const;

/** LEDs are round (SPEC §12.2: "LEDs 50%"): radius = half the box. */
export const ledRadius = '50%';

/**
 * Smallest touchable control, in dp. SPEC §12.6/§12.9 make this an acceptance
 * criterion ("anything you touch mid-practice is ≥48dp"), not a per-screen
 * layout choice, so it has one owner here. A control drawn smaller reaches it
 * with hitSlop rather than by growing its box.
 */
export const minTouchTargetDp = 48;

// --- Type (SPEC §12.2) ------------------------------------------------------
// Two OFL faces: Space Grotesk (display, numerics, labels — true tabular
// figures) and Inter (body/UI). Numeric readouts also set fontVariant
// ['tabular-nums'] (§12.2); `tabular` records where §12.2 mandates it.

export const fontFamily = {
  display: 'Space Grotesk',
  body: 'Inter',
} as const;

export interface TypeRole {
  readonly family: string;
  readonly weight: number;
  readonly size: number;
  /** Extra tracking as an em fraction (SPEC §12.2 "+18%" → 0.18). */
  readonly tracking?: number;
  readonly uppercase?: boolean;
  /** SPEC §12.2 mandates tabular figures for this role. */
  readonly tabular?: boolean;
}

export const TYPE_ROLES = ['display', 'headline', 'body', 'label'] as const;

export type TypeRoleName = (typeof TYPE_ROLES)[number];

/** SPEC §12.2 type roles. */
export const typography: Readonly<Record<TypeRoleName, TypeRole>> = {
  display: { family: fontFamily.display, weight: 700, size: 64, tabular: true },
  headline: { family: fontFamily.display, weight: 500, size: 22 },
  body: { family: fontFamily.body, weight: 400, size: 15 },
  label: {
    family: fontFamily.display,
    weight: 500,
    size: 12,
    tracking: 0.18,
    uppercase: true,
  },
};

// --- Shadow (SPEC §12.2) ----------------------------------------------------
// Used on sheets and the play button only. One value per theme.

export const shadow: Readonly<Record<'sheet', ColorPair>> = {
  sheet: {
    dark: '0 8px 32px rgba(0,0,0,.45)',
    light: '0 8px 28px rgba(60,50,20,.14)',
  },
};

// --- Theme resolution -------------------------------------------------------
// Everything below is DERIVED from the tokens above — never a second copy of a
// value (SPEC §13.7). Skia and RN StyleSheet read `resolveTheme`; NativeWind's
// vars() reads `themeVars`; the generator reads `renderTailwindConfig` and
// `renderThemeCss`. Change a token above and all four follow automatically.

export type ThemeMode = 'dark' | 'light';

/** The CSS custom-property name a token resolves to. Single owner of the name
 * so the Tailwind config and the CSS var declarations cannot drift apart. */
export function colorVarName(token: ColorToken): string {
  return `--color-${token}`;
}

export const SHADOW_VAR_NAME = '--shadow-sheet';

/** Flat hex map for one theme — what Skia and RN StyleSheet consume directly
 * (SPEC §13.8.1: "Skia reads tokens from the TS export directly"). */
export function resolveTheme(mode: ThemeMode): Record<ColorToken, string> {
  const out = {} as Record<ColorToken, string>;
  for (const token of COLOR_TOKENS) {
    out[token] = palette[token][mode];
  }
  return out;
}

/** CSS-variable map for one theme — the payload for NativeWind's vars() so an
 * explicit System/Dark/Light override drives the theme layer, not Tailwind's
 * `dark:` variant (SPEC §13.8.1). */
export function themeVars(mode: ThemeMode): Record<string, string> {
  const out: Record<string, string> = {};
  for (const token of COLOR_TOKENS) {
    out[colorVarName(token)] = palette[token][mode];
  }
  out[SHADOW_VAR_NAME] = shadow.sheet[mode];
  return out;
}

const GENERATED_BANNER =
  'GENERATED — do not edit. Source: @kitbag/core-design src/tokens.ts ' +
  '(SPEC §12.2). Regenerate: pnpm --filter @kitbag/core-design generate';

/** The Tailwind theme, generated from the tokens. Colours resolve to CSS
 * variables (no hex here — a hex literal cannot survive a regenerate, SPEC
 * §13.8.1); radii, type and shadow carry their §12.2 values. */
export function renderTailwindConfig(): string {
  const colors = COLOR_TOKENS.map(
    (t) => `        ${t}: 'var(${colorVarName(t)})',`,
  ).join('\n');

  const borderRadius = [
    `        card: '${String(radii.card)}px',`,
    `        tile: '${String(radii.tile)}px',`,
    `        chip: '${String(radii.chip)}px',`,
    `        button: '${String(radii.button)}px',`,
    `        'sheet-top': '${String(radii.sheetTop)}px',`,
    `        'sheet-bottom': '${String(radii.sheetBottom)}px',`,
    `        led: '${ledRadius}',`,
  ].join('\n');

  const fontSize = TYPE_ROLES.map(
    (r) => `        ${r}: '${String(typography[r].size)}px',`,
  ).join('\n');
  const fontWeight = TYPE_ROLES.map(
    (r) => `        ${r}: '${String(typography[r].weight)}',`,
  ).join('\n');
  const labelTracking = `${String(typography.label.tracking ?? 0)}em`;

  return `// ${GENERATED_BANNER}
/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
${colors}
      },
      borderRadius: {
${borderRadius}
      },
      fontFamily: {
        display: ['${fontFamily.display}'],
        body: ['${fontFamily.body}'],
      },
      fontSize: {
${fontSize}
      },
      fontWeight: {
${fontWeight}
      },
      letterSpacing: {
        label: '${labelTracking}',
      },
      boxShadow: {
        sheet: 'var(${SHADOW_VAR_NAME})',
      },
    },
  },
};
`;
}

function renderVarBlock(mode: ThemeMode, indent: string): string {
  const lines = COLOR_TOKENS.map(
    (t) => `${indent}${colorVarName(t)}: ${palette[t][mode]};`,
  );
  lines.push(`${indent}${SHADOW_VAR_NAME}: ${shadow.sheet[mode]};`);
  return lines.join('\n');
}

/** The CSS that carries the palette hex, generated from the tokens. Dark is the
 * `:root` default (SPEC §12.2); Light applies under the OS preference for the
 * System theme. Explicit Dark/Light is driven at runtime via NativeWind vars()
 * with `themeVars(mode)` (SPEC §13.8.1) — the theme layer is the authority,
 * not Tailwind's `dark:` variant. */
export function renderThemeCss(): string {
  return `/* ${GENERATED_BANNER} */
@import 'tailwindcss';
@config './tailwind.config.js';

/* Dark ("Stage") — primary (SPEC §12.2). */
:root {
${renderVarBlock('dark', '  ')}
}

/* Light ("Daylight") — System resolution via OS preference (SPEC §12.5). */
@media (prefers-color-scheme: light) {
  :root {
${renderVarBlock('light', '    ')}
  }
}
`;
}
