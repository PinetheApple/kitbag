import { useState } from 'react';
import { useAnimatedReaction, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export function useCrossedIndex<T>(
  songSec: SharedValue<number>,
  items: readonly T[],
  indexAt: (items: readonly T[], songSec: number) => number,
  none: number,
): number {
  const [current, setCurrent] = useState(none);
  useAnimatedReaction(
    () => indexAt(items, songSec.value),
    (now, before) => {
      if (now !== before) scheduleOnRN(setCurrent, now);
    },
    [items, songSec, indexAt],
  );
  return current;
}
