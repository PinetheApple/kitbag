import type { LibrarySongRow } from '@kitbag/core-db';

export type SongBadge = 'pending' | 'analyzing' | 'grid' | 'noGrid' | 'failed';

type BadgedSong = Pick<LibrarySongRow, 'analysisStatus' | 'hasGrid'>;

// A grid stands until a new one replaces it: a failed re-analysis keeps it,
// and the player keeps it while a re-analysis runs.
export function songBadge(song: BadgedSong): SongBadge {
  switch (song.analysisStatus) {
    case 'pending':
      return 'pending';
    case 'analyzing':
      return 'analyzing';
    case 'failed':
      return song.hasGrid ? 'grid' : 'failed';
    case 'done':
      return song.hasGrid ? 'grid' : 'noGrid';
  }
}

export function playerSongBadge(song: BadgedSong): SongBadge {
  return song.hasGrid ? 'grid' : songBadge(song);
}
