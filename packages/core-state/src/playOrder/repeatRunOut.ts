import { ADVANCE_CAUSE, type AdvanceCause } from '../stemPlayer/songEnd.ts';
import type { AdvancingPlayer, AdvancingPlayers } from './autoAdvance.ts';
import { ADVANCE, type Advance, type PlayerKind } from './order.ts';
import { SKIP, type SkippedSong } from './queuedSongText.ts';
import { REPEAT, type RepeatMode } from './repeat.ts';

export interface RunOut {
  readonly from: PlayerKind;
  readonly lastAdvance: Advance['kind'];
  readonly skipped: SkippedSong | null;
  readonly failedOpen: boolean;
}

export function repeatSong(player: AdvancingPlayer): void {
  if (player.stillEnded() && !player.loopHeld()) player.replay();
}

export const repeatsAlone = (
  mode: RepeatMode | undefined,
  cause: AdvanceCause,
  { lastAdvance, failedOpen }: RunOut,
): boolean =>
  cause === ADVANCE_CAUSE.ended &&
  mode === REPEAT.all &&
  lastAdvance === ADVANCE.end &&
  !failedOpen;

export function runOut(
  players: AdvancingPlayers,
  mode: RepeatMode | undefined,
  cause: AdvanceCause,
  out: RunOut,
): SkippedSong | null {
  const player = players[out.from];
  if (repeatsAlone(mode, cause, out)) {
    repeatSong(player);
    return null;
  }
  player.stopAdvancing();
  return out.skipped?.reason === SKIP.deleted ? out.skipped : null;
}
