import type { ToolHost } from '@kitbag/core-plugin-api';
import { useState } from 'react';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';

export function useDrillReaction(host: ToolHost) {
  const { barPhase } = host.engine.reads;
  const [phase, setPhase] = useState(0);

  useAnimatedReaction(
    () => barPhase(),
    (next) => {
      runOnJS(setPhase)(next);
    },
  );

  return phase;
}
