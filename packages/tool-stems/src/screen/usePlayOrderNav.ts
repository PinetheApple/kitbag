import type { QueuedSong } from '@kitbag/core-state';
import { useAfterSheetClosed } from '@kitbag/core-design';
import { useCallback } from 'react';

export interface PlayOrderRoutes {
  readonly onOpenStemSet: (stemSetId: number) => void;
  readonly onOpenSong: (songId: number) => void;
  readonly onOpenMetronome: () => void;
  readonly onNotice: (message: string) => void;
}

export const TO_METRONOME = { kind: 'metronome' } as const;

export type Leave =
  | { readonly kind: 'stem'; readonly stemSetId: number }
  | { readonly kind: 'song'; readonly songId: number }
  | { readonly kind: 'metronome' };

export function leaveForQueued(song: QueuedSong): Leave {
  return song.kind === 'song'
    ? { kind: 'song', songId: song.id }
    : { kind: 'stem', stemSetId: song.id };
}

export function followLeave(routes: PlayOrderRoutes, leave: Leave): void {
  if (leave.kind === 'stem') routes.onOpenStemSet(leave.stemSetId);
  else if (leave.kind === 'song') routes.onOpenSong(leave.songId);
  else routes.onOpenMetronome();
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
