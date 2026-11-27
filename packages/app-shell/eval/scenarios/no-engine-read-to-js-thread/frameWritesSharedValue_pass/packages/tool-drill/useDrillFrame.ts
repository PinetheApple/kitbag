import type { ToolHost } from '@kitbag/core-plugin-api';
import { useCallback, useState } from 'react';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export function useDrillFrame(host: ToolHost) {
  const { barPhase, currentBeat } = host.engine.reads;
  const phase = useSharedValue(0);
  const [bars, setBars] = useState(0);
  const countBar = useCallback(() => {
    setBars((count) => count + 1);
  }, []);

  useFrameCallback(() => {
    'worklet';
    phase.value = barPhase();
    if (currentBeat() === 0) scheduleOnRN(countBar);
  });

  return { phase, bars };
}
