import {
  BeatLedRow,
  type LedSize,
  type NeighbourGaps,
} from '@kitbag/core-design';
import { KB_ACCENT } from '@kitbag/core-native';
import { useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import { beatLabel, ledStateFor } from '../logic/beatDot.ts';
import { layoutBeatLeds } from '../logic/ledLayout.ts';

interface BeatLedsProps {
  readonly beatCount: number;
  readonly accents: readonly KB_ACCENT[];
  readonly currentBeat: SharedValue<number>;
  readonly size?: LedSize;
  readonly onCycle?: ((beat: number) => void) | undefined;
  readonly neighbourGapDp: NeighbourGaps;
}

export function BeatLeds({
  beatCount,
  accents,
  currentBeat,
  size = 'main',
  onCycle,
  neighbourGapDp,
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
      neighbourGapDp={neighbourGapDp}
    />
  );
}
