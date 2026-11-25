import { sameQueuedSong, type QueuedSong } from '@kitbag/core-db';

export const ROW_TAP = { asIs: 'asIs', view: 'view' } as const;

export type RowTap = (typeof ROW_TAP)[keyof typeof ROW_TAP];

export function rowTap(tapped: QueuedSong, shown: QueuedSong | null): RowTap {
  return shown !== null && sameQueuedSong(tapped, shown)
    ? ROW_TAP.asIs
    : ROW_TAP.view;
}
