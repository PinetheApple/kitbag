import { useLibrary } from '@kitbag/core-state';
import { useMemo } from 'react';

import {
  unsavedSnackbarView,
  type SnackbarView,
} from '../logic/unsavedSnackbar.ts';

export function useUnsavedSnackbarView(
  visibleSince: number,
): SnackbarView | undefined {
  const discarded = useLibrary((s) => s.discarded);
  const presets = useLibrary((s) => s.presets);
  return useMemo(
    () => unsavedSnackbarView(discarded, presets, visibleSince),
    [discarded, presets, visibleSince],
  );
}
