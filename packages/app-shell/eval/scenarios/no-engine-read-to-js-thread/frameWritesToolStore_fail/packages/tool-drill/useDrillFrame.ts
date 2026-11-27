import type { ToolHost } from '@kitbag/core-plugin-api';
import { useFrameCallback } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export function useDrillFrame(host: ToolHost) {
  const { barPhase } = host.engine.reads;
  const store = host.store.createToolStore({ phase: 0 });

  useFrameCallback(() => {
    'worklet';
    scheduleOnRN(store.setState, { phase: barPhase() });
  });

  return store;
}
