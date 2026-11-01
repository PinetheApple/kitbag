import { SNACKBAR_DURATION_MS } from '@kitbag/core-design';
import type { DiscardedChanges } from '@kitbag/core-state';

import {
  loadedSongName,
  notSavedMessage,
  type NamedSong,
} from './setlistChip.ts';

export type DiscardedSong = Pick<DiscardedChanges, 'loaded' | 'at'>;

export interface UnsavedSnackbarView {
  readonly message: string;
  readonly timeLeftMs: number;
}

// Back from the background, the window runs from the discard, not from now.
export function unsavedSnackbarView(
  discarded: DiscardedSong | null,
  presets: readonly NamedSong[],
  visibleSince: number,
): UnsavedSnackbarView | undefined {
  if (discarded === null) return undefined;
  const song = loadedSongName(presets, discarded.loaded);
  const now = Math.max(visibleSince, discarded.at);
  const timeLeftMs = discarded.at + SNACKBAR_DURATION_MS - now;
  if (song === undefined || timeLeftMs <= 0) return undefined;
  return { message: notSavedMessage(song), timeLeftMs };
}
