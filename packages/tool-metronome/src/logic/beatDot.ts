import type { LedState } from '@kitbag/core-design';
import { KB_ACCENT } from '@kitbag/core-native';

export function ledStateFor(accent: KB_ACCENT): LedState {
  if (accent === KB_ACCENT.KB_ACCENT_ACCENTED) return 'accented';
  if (accent === KB_ACCENT.KB_ACCENT_MUTED) return 'muted';
  return 'normal';
}

export function beatLabel(beat: number, state: LedState): string {
  return `Beat ${String(beat + 1)}, ${state}`;
}

// An empty Text carries no fragment, so RN's text measure cache key loses the
// font scale and replays the old height after a text-size change (#202).
export const MARKER_PLACEHOLDER = '\u00A0';

export function beatMarker(beat: number): string {
  return beat === 0 ? '1' : MARKER_PLACEHOLDER;
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
  readonly backgroundColor: string;
  readonly borderColor: string;
  readonly borderWidth: number;
}

export function dotLook(
  state: LedState,
  sounding: boolean,
  silentBar: boolean,
  palette: DotPalette,
  widths: DotWidths,
): DotLook {
  'worklet';
  if (silentBar && sounding) {
    return {
      backgroundColor: palette.clear,
      borderColor: palette.silentNow,
      borderWidth: widths.silentNow,
    };
  }
  if (silentBar || state === 'muted') {
    return {
      backgroundColor: palette.clear,
      borderColor: sounding ? palette.silentNow : palette.hollow,
      borderWidth: widths.normal,
    };
  }
  const ring = state === 'accented' ? widths.accent : widths.normal;
  if (sounding) {
    return {
      backgroundColor: palette.accent,
      borderColor: palette.accent,
      borderWidth: ring,
    };
  }
  if (state === 'accented') {
    return {
      backgroundColor: palette.clear,
      borderColor: palette.accent,
      borderWidth: ring,
    };
  }
  return {
    backgroundColor: palette.fill,
    borderColor: palette.border,
    borderWidth: widths.normal,
  };
}
