import { BeatLedRow, type LedSize, type LedState } from '@kitbag/core-design';
import { KB_ACCENT } from '@kitbag/core-native';
import { useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import { layoutBeatLeds } from '../logic/ledLayout.ts';

function ledStateFor(accent: KB_ACCENT): LedState {
  if (accent === KB_ACCENT.KB_ACCENT_ACCENTED) return 'accented';
  if (accent === KB_ACCENT.KB_ACCENT_MUTED) return 'muted';
  return 'normal';
}

function beatLabel(beat: number, state: LedState): string {
  return `Beat ${String(beat + 1)}, ${state}`;
}

interface BeatLedsProps {
  readonly beatCount: number;
  readonly accents: readonly KB_ACCENT[];
  readonly currentBeat: SharedValue<number>;
  readonly size?: LedSize;
  readonly onCycle?: ((beat: number) => void) | undefined;
}

export function BeatLeds({
  beatCount,
  accents,
  currentBeat,
  size = 'main',
  onCycle,
}: BeatLedsProps) {
  const layout = useMemo(() => layoutBeatLeds(beatCount), [beatCount]);
  const states = useMemo(
    () =>
      Array.from({ length: beatCount }, (_unused, beat) =>
        ledStateFor(accents[beat] ?? KB_ACCENT.KB_ACCENT_NORMAL),
      ),
    [accents, beatCount],
  );

  return (
    <BeatLedRow
      layout={layout}
      states={states}
      activeBeat={currentBeat}
      size={size}
      ledLabel={beatLabel}
      onPressBeat={onCycle}
    />
  );
}
