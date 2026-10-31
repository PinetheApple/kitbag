import { SNACKBAR_DURATION_MS } from '@kitbag/core-design';
import type { DiscardedChanges, SongPreset } from '@kitbag/core-state';

import { loadedSongName, notSavedMessage } from './setlistChip.ts';

export interface UnsavedSnackbarView {
  readonly message: string;
  readonly timeLeftMs: number;
}

export function unsavedSnackbarView(
  discarded: DiscardedChanges | null,
  presets: readonly SongPreset[],
  now: number,
): UnsavedSnackbarView | undefined {
  if (discarded === null) return undefined;
  const song = loadedSongName(presets, discarded.loaded);
  const timeLeftMs = discarded.at + SNACKBAR_DURATION_MS - now;
  if (song === undefined || timeLeftMs <= 0) return undefined;
  return { message: notSavedMessage(song), timeLeftMs };
}
