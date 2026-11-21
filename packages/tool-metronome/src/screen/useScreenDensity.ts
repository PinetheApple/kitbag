import { metronome } from '@kitbag/core-design';

import { screenDensity, type ScreenDensity } from '../logic/screenDensity.ts';
import { useOverflowLatch } from './useOverflowLatch.ts';

export function useScreenDensity(
  windowHeight: number,
  layoutKey: string,
  overflowing: boolean,
): ScreenDensity {
  const room = {
    windowHeight,
    compactBelowHeight: metronome.compactBelowHeight,
  };
  const roomyWindow =
    screenDensity({ ...room, overflowedWhenRoomy: false }) === 'roomy';
  const overflowedWhenRoomy = useOverflowLatch(
    layoutKey,
    overflowing,
    roomyWindow,
  );
  return screenDensity({ ...room, overflowedWhenRoomy });
}
