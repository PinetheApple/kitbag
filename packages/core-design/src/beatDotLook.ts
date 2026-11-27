import type { LedState } from './components/BeatLed.tsx';
import { TEXT_PLACEHOLDER } from './textPlaceholder.ts';

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

export interface DotLook {
  readonly fill: string;
  readonly edge: string;
  readonly accentEdge: string;
  readonly silentNowEdge: string;
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
      silentNowEdge: palette.silentNow,
    };
  }
  if (silentBar || state === 'muted') {
    return {
      fill: clear,
      edge: sounding ? palette.silentNow : palette.hollow,
      accentEdge: clear,
      silentNowEdge: clear,
    };
  }
  const accentEdge = state === 'accented' ? palette.accent : clear;
  if (sounding) {
    return {
      fill: palette.accent,
      edge: palette.accent,
      accentEdge,
      silentNowEdge: clear,
    };
  }
  if (state === 'accented') {
    return {
      fill: clear,
      edge: palette.accent,
      accentEdge,
      silentNowEdge: clear,
    };
  }
  return {
    fill: palette.fill,
    edge: palette.border,
    accentEdge: clear,
    silentNowEdge: clear,
  };
}
