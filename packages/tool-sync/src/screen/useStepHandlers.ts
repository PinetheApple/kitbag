import type { BeatDirection } from '@kitbag/core-state';
import { useCallback } from 'react';

import { EARLIER, LATER } from './phaseKeys.ts';

export function useStepHandlers(step: (direction: BeatDirection) => void): {
  readonly onEarlier: () => void;
  readonly onLater: () => void;
} {
  const onEarlier = useCallback(() => {
    step(EARLIER);
  }, [step]);
  const onLater = useCallback(() => {
    step(LATER);
  }, [step]);
  return { onEarlier, onLater };
}
