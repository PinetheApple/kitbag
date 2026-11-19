import type { SongPlayerStore } from '../songPlayer/store.ts';
import type { StemPlayerState, StemPlayerStatus } from '../stemPlayer/store.ts';

export interface PlayerTracks {
  readonly song: number | null;
  readonly stems: number | null;
}

const CLOSED = 'idle' satisfies StemPlayerStatus;

export const NO_TRACKS: PlayerTracks = { song: null, stems: null };

export function playerTracks(
  song: Pick<SongPlayerStore, 'status' | 'songId'>,
  stems: Pick<StemPlayerState, 'status' | 'setId'>,
): PlayerTracks {
  return {
    song: song.status === CLOSED ? null : song.songId,
    stems: stems.status === CLOSED ? null : stems.setId,
  };
}

// A player lets go once it closes or opens something else; reopening loads
// through the switched folder, so a released player stays released.
export function stillHolding(
  holders: PlayerTracks,
  now: PlayerTracks,
): PlayerTracks {
  return {
    song:
      holders.song !== null && now.song === holders.song ? holders.song : null,
    stems:
      holders.stems !== null && now.stems === holders.stems
        ? holders.stems
        : null,
  };
}

export function oldRootReleased(holders: PlayerTracks): boolean {
  return holders.song === null && holders.stems === null;
}
