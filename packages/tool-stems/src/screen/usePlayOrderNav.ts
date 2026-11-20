import {
  handOverQueued,
  isPresetEntry,
  usePlayOrder,
  type QueuedSong,
  type SetlistEntry,
} from '@kitbag/core-state';
import { playerWaveBars, useAfterSheetClosed } from '@kitbag/core-design';
import { useCallback, useMemo } from 'react';

export interface PlayOrderRoutes {
  readonly onOpenStemSet: (stemSetId: number) => void;
  readonly onOpenSong: (songId: number) => void;
  readonly onOpenMetronome: () => void;
  readonly onNotice: (message: string) => void;
}

export type Leave =
  | { readonly kind: 'stem'; readonly stemSetId: number }
  | { readonly kind: 'song'; readonly songId: number }
  | { readonly kind: 'metronome' };

export function leaveForQueued(song: QueuedSong): Leave {
  return song.kind === 'song'
    ? { kind: 'song', songId: song.id }
    : { kind: 'stem', stemSetId: song.id };
}

function handOverToSong(routes: PlayOrderRoutes, songId: number): void {
  void handOverQueued('stems', { kind: 'song', id: songId }, playerWaveBars);
  routes.onOpenSong(songId);
}

export function followLeave(routes: PlayOrderRoutes, leave: Leave): void {
  if (leave.kind === 'stem') routes.onOpenStemSet(leave.stemSetId);
  else if (leave.kind === 'song') handOverToSong(routes, leave.songId);
  else routes.onOpenMetronome();
}

export function leaveOf(entry: SetlistEntry): Leave {
  return isPresetEntry(entry)
    ? { kind: 'metronome' }
    : { kind: 'stem', stemSetId: entry.stemSetId };
}

export function useLeaveAfterClose(routes: PlayOrderRoutes, visible: boolean) {
  const { after, closed } = useAfterSheetClosed(visible);
  const leaveFor = useCallback(
    (leave: Leave) => {
      after(() => {
        followLeave(routes, leave);
      });
    },
    [after, routes],
  );
  return { leaveFor, closed };
}

export function usePlayOrderNav() {
  const openEntry = usePlayOrder((s) => s.openEntry);
  return useMemo(() => ({ openEntry }), [openEntry]);
}
