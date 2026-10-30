import { metronome } from '@kitbag/core-design';
import { useEffect, useState } from 'react';

import { screenDensity, type ScreenDensity } from '../logic/screenDensity.ts';

// A roomy screen that overflowed stays compact until the layout it measured
// changes, so the two densities never alternate.
export function useScreenDensity(
  windowHeight: number,
  layoutKey: string,
  overflowing: boolean,
): ScreenDensity {
  const [overflowedKey, setOverflowedKey] = useState<string | null>(null);
  const density = screenDensity({
    windowHeight,
    compactBelowHeight: metronome.compactBelowHeight,
    overflowedWhenRoomy: overflowedKey === layoutKey,
  });
  useEffect(() => {
    if (density === 'roomy' && overflowing) setOverflowedKey(layoutKey);
  }, [density, overflowing, layoutKey]);
  return density;
}
