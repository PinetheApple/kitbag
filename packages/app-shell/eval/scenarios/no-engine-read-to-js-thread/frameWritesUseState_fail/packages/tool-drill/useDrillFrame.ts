import type { ToolHost } from '@kitbag/core-plugin-api';
import { useState } from 'react';
import { useFrameCallback } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export function useDrillFrame(host: ToolHost) {
  const { currentBpm } = host.engine.reads;
  const [tempo, setTempo] = useState(0);

  useFrameCallback(() => {
    'worklet';
    scheduleOnRN(setTempo, currentBpm());
  });

  return tempo;
}
