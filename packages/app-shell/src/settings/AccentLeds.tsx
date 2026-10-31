import { BeatLedRow, type LedSize, type LedState } from '@kitbag/core-design';
import { KB_STOPPED_BEAT } from '@kitbag/core-native';
import { accentedSlots, ON_BEAT_SLOT } from '@kitbag/core-state';
import { useMemo } from 'react';
import { useSharedValue } from 'react-native-reanimated';

import { slotLayout } from './slotLayout.ts';

const PER_ROW: Readonly<Record<LedSize, number>> = { small: 4, main: 8 };

function slotLabel(slot: number, state: LedState): string {
  if (slot === ON_BEAT_SLOT) return 'Slot 1, the beat, accented by the beat';
  return `Slot ${String(slot + 1)}, ${state}`;
}

export interface AccentLedsProps {
  readonly mask: number;
  readonly count: number;
  readonly size: LedSize;
  readonly onPressSlot?: (slot: number) => void;
}

export function AccentLeds({
  mask,
  count,
  size,
  onPressSlot,
}: AccentLedsProps) {
  const silent = useSharedValue(KB_STOPPED_BEAT);
  const layout = useMemo(() => slotLayout(count, PER_ROW[size]), [count, size]);
  const states = useMemo(
    () =>
      accentedSlots(mask, count).map<LedState>((accented) =>
        accented ? 'accented' : 'normal',
      ),
    [mask, count],
  );
  return (
    <BeatLedRow
      layout={layout}
      states={states}
      activeBeat={silent}
      size={size}
      ledLabel={slotLabel}
      onPressBeat={onPressSlot}
    />
  );
}
