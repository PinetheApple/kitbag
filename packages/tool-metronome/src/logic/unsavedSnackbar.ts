import { snackbarTimeLeftMs } from '@kitbag/core-design';
import type { DiscardedChanges } from '@kitbag/core-state';

import {
  loadedSongName,
  notSavedMessage,
  type NamedSong,
} from './setlistChip.ts';

export type DiscardedSong = Pick<DiscardedChanges, 'loaded' | 'at'>;

export interface SnackbarView {
  readonly message: string;
  readonly timeLeftMs: number;
}

export function unsavedSnackbarView(
  discarded: DiscardedSong | null,
  presets: readonly NamedSong[],
  visibleSince: number,
): SnackbarView | undefined {
  if (discarded === null) return undefined;
  const song = loadedSongName(presets, discarded.loaded);
  const timeLeftMs = snackbarTimeLeftMs(discarded.at, visibleSince);
  if (song === undefined || timeLeftMs <= 0) return undefined;
  return { message: notSavedMessage(song), timeLeftMs };
}
