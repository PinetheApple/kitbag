import type { LedState } from '@kitbag/core-design';
import { KB_ACCENT } from '@kitbag/core-native';

export function accentLedState(accent: KB_ACCENT): LedState {
  if (accent === KB_ACCENT.KB_ACCENT_ACCENTED) return 'accented';
  if (accent === KB_ACCENT.KB_ACCENT_MUTED) return 'muted';
  return 'normal';
}

export function accentLedLabel(beat: number, state: LedState): string {
  return `Beat ${String(beat + 1)}, ${state}`;
}
