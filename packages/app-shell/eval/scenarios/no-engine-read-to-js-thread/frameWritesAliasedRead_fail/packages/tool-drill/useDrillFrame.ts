import type { ToolHost } from '@kitbag/core-plugin-api';
import { useState } from 'react';
import { useFrameCallback } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export function useDrillFrame(host: ToolHost) {
  const reads = host.engine.reads;
  const [beat, setBeat] = useState(0);

  useFrameCallback(() => {
    'worklet';
    const current = reads.currentBeat();
    const shown = current + 1;
    scheduleOnRN(setBeat, shown);
  });

  return beat;
}
