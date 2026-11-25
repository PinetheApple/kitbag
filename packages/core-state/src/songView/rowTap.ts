import type { QueuedSong } from '@kitbag/core-db';

import type { SongPlayerState } from '../songPlayer/state.ts';
import { ATTACHABLE } from '../stemPlayer/mixerSession.ts';
import type { StemPlayerState } from '../stemPlayer/store.ts';

export const ROW_TAP = { asIs: 'asIs', view: 'view' } as const;

export type RowTap = (typeof ROW_TAP)[keyof typeof ROW_TAP];

export interface OpenPlayers {
  readonly song: Pick<SongPlayerState, 'status' | 'songId'>;
  readonly stems: Pick<StemPlayerState, 'status' | 'setId'>;
}

function openId({ song, stems }: OpenPlayers, kind: QueuedSong['kind']) {
  if (kind === 'stems')
    return ATTACHABLE.has(stems.status) ? stems.setId : null;
  return ATTACHABLE.has(song.status) ? song.songId : null;
}

export function rowTap(tapped: QueuedSong, players: OpenPlayers): RowTap {
  return openId(players, tapped.kind) === tapped.id
    ? ROW_TAP.asIs
    : ROW_TAP.view;
}
