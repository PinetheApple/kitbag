import {
  beatLabel,
  BeatLedRow,
  type LedSize,
  type NeighbourGaps,
} from '@kitbag/core-design';
import type { KB_ACCENT } from '@kitbag/core-native';
import { useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { layoutBeatLeds, ledStatesFor } from '@kitbag/core-state';

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
    () => ledStatesFor(accents, beatCount),
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
