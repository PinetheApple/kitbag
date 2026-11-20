import { isPresetEntry, useLibrary, type SongStep } from '@kitbag/core-state';
import { useCallback } from 'react';

import { useOpenStemPlayer } from './useOpenStemPlayer.ts';

export interface StemStepHandlers {
  readonly onOpenStemSet?: ((stemSetId: number) => void) | undefined;
  readonly onSkipped?: (() => void) | undefined;
}

export function useStepSong({ onOpenStemSet, onSkipped }: StemStepHandlers) {
  const stepSong = useLibrary((s) => s.stepSong);
  const carrySkip = useLibrary((s) => s.carrySkip);
  const openStemPlayer = useOpenStemPlayer(onOpenStemSet);
  return useCallback(
    async (step: SongStep) => {
      const { entry, skipped } = await stepSong(step);
      if (entry === undefined || isPresetEntry(entry)) {
        if (skipped) onSkipped?.();
        return;
      }
      if (skipped) carrySkip(true);
      openStemPlayer(entry.stemSetId);
    },
    [stepSong, carrySkip, openStemPlayer, onSkipped],
  );
}
