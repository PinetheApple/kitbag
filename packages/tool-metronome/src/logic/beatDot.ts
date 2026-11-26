import type { LedState } from '@kitbag/core-design';
import { KB_ACCENT } from '@kitbag/core-native';

import { TEXT_PLACEHOLDER } from './textPlaceholder.ts';

export function ledStateFor(accent: KB_ACCENT): LedState {
  if (accent === KB_ACCENT.KB_ACCENT_ACCENTED) return 'accented';
  if (accent === KB_ACCENT.KB_ACCENT_MUTED) return 'muted';
  return 'normal';
}

export function beatLabel(beat: number, state: LedState): string {
  return `Beat ${String(beat + 1)}, ${state}`;
}

export function beatMarker(beat: number): string {
  return beat === 0 ? '1' : TEXT_PLACEHOLDER;
}

export interface DotPalette {
  readonly accent: string;
  readonly fill: string;
  readonly border: string;
  readonly hollow: string;
  readonly silentNow: string;
  readonly clear: string;
}

export interface DotWidths {
  readonly normal: number;
  readonly accent: number;
  readonly silentNow: number;
}

export interface DotLook {
  readonly fill: string;
  readonly edge: string;
  readonly accentEdge: string;
  readonly silentEdge: string;
}

export function dotLook(
  state: LedState,
  sounding: boolean,
  silentBar: boolean,
  palette: DotPalette,
): DotLook {
  'worklet';
  const { clear } = palette;
  if (silentBar && sounding) {
    return {
      fill: clear,
      edge: clear,
      accentEdge: clear,
      silentEdge: palette.silentNow,
    };
  }
  if (silentBar || state === 'muted') {
    return {
      fill: clear,
      edge: sounding ? palette.silentNow : palette.hollow,
      accentEdge: clear,
      silentEdge: clear,
    };
  }
  const accentEdge = state === 'accented' ? palette.accent : clear;
  if (sounding) {
    return {
      fill: palette.accent,
      edge: palette.accent,
      accentEdge,
      silentEdge: clear,
    };
  }
  if (state === 'accented') {
    return { fill: clear, edge: palette.accent, accentEdge, silentEdge: clear };
  }
  return {
    fill: palette.fill,
    edge: palette.border,
    accentEdge: clear,
    silentEdge: clear,
  };
}
