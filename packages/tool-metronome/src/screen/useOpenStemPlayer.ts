import { useMetronome } from '@kitbag/core-state';
import { useCallback } from 'react';

export function useOpenStemPlayer(
  onOpenStemSet: ((stemSetId: number) => void) | undefined,
) {
  const stop = useMetronome((s) => s.stop);
  return useCallback(
    (stemSetId: number) => {
      stop();
      onOpenStemSet?.(stemSetId);
    },
    [stop, onOpenStemSet],
  );
}
