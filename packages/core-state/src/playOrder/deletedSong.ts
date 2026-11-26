import { sameQueuedSong, type QueuedSong } from '@kitbag/core-db';

import type { ShownPlayer } from './shownPlayer.ts';

export function moveOffDeleted(
  player: ShownPlayer,
  deleted: QueuedSong,
  wasPlaying: boolean,
): void {
  const shown = player.shown();
  if (shown === null || !sameQueuedSong(shown, deleted)) return;
  if (player.hasNext()) player.next(deleted.kind, wasPlaying);
  else player.close();
}
