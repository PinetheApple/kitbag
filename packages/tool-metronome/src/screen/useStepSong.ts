import {
  isPresetEntry,
  useLibrary,
  useMetronome,
  type SongStep,
} from '@kitbag/core-state';
import { useCallback } from 'react';

export interface StemStepHandlers {
  readonly onOpenStemSet?: ((stemSetId: number) => void) | undefined;
  readonly onSkipped?: (() => void) | undefined;
}

export function useStepSong({ onOpenStemSet, onSkipped }: StemStepHandlers) {
  const stepSong = useLibrary((s) => s.stepSong);
  const carrySkip = useLibrary((s) => s.carrySkip);
  const stop = useMetronome((s) => s.stop);
  return useCallback(
    async (step: SongStep) => {
      const { entry, skipped } = await stepSong(step);
      if (entry === undefined || isPresetEntry(entry)) {
        if (skipped) onSkipped?.();
        return;
      }
      stop();
      if (skipped) carrySkip(true);
      onOpenStemSet?.(entry.stemSetId);
    },
    [stepSong, carrySkip, stop, onOpenStemSet, onSkipped],
  );
}
