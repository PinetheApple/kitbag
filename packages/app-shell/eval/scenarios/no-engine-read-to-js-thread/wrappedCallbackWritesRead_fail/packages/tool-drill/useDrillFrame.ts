import type { ToolHost } from '@kitbag/core-plugin-api';
import { useCallback, useState } from 'react';
import { runOnJS, useFrameCallback } from 'react-native-reanimated';

export function useDrillFrame(host: ToolHost) {
  const { currentBpm } = host.engine.reads;
  const [tempo, setTempo] = useState(0);
  const push = useCallback((bpm: number) => {
    setTempo(bpm);
  }, []);
  const onFrame = useCallback(() => {
    'worklet';
    runOnJS(push)(currentBpm());
  }, [push, currentBpm]);

  useFrameCallback(onFrame);
  return tempo;
}
