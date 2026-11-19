import { countLabel } from '@kitbag/core-design';
import type { DataFolderVolumes, MoveStatus } from '@kitbag/core-native';
import type { LibraryView } from '@kitbag/core-state';

import { capitalised } from '../settings/capitalised.ts';
import {
  progressBytes,
  switchedTitle,
} from '../settings/dataFolderMoveText.ts';
import {
  movePercent,
  OLD_COPIES_LEFT,
  OLD_COPIES_WAITING,
  pausedTitle,
  placeName,
} from '../settings/dataFolderText.ts';
import { SEPARATOR } from '../settings/separator.ts';

export interface StripInput {
  readonly move: MoveStatus | null;
  readonly volumes: DataFolderVolumes | null;
  readonly unavailable: number;
  readonly view: LibraryView;
}

export type LibraryStrip =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'move';
      readonly title: string;
      readonly detail: string;
      readonly percent: number | null;
    }
  | {
      readonly kind: 'missing';
      readonly title: string;
      readonly detail: string;
    };

const NOUNS: Readonly<Record<LibraryView, readonly [string, string]>> = {
  songs: ['song', 'songs'],
  stems: ['stem song', 'stem songs'],
};

const STILL_PLAY = 'songs still play';

export function cardMissingTitle(volumeUuid: string | null): string {
  return `${capitalised(placeName(volumeUuid))} not found`;
}

function missingDetail(count: number, view: LibraryView): string {
  const [one, many] = NOUNS[view];
  return `${countLabel(count, one, many)} on it can’t play until it’s back`;
}

function moveStrip(move: MoveStatus): LibraryStrip {
  if (move.switched) {
    const kept = move.error === null || move.running;
    return {
      kind: 'move',
      title: switchedTitle(move),
      detail: capitalised(kept ? OLD_COPIES_WAITING : OLD_COPIES_LEFT),
      percent: null,
    };
  }
  const [done, ofTotal] = progressBytes(move);
  return {
    kind: 'move',
    title: move.running
      ? `Moving files to ${placeName(move.targetVolumeUuid)}`
      : pausedTitle(move),
    detail: `${done} ${ofTotal} ${SEPARATOR} ${STILL_PLAY}`,
    percent: movePercent(move),
  };
}

export function libraryStrip({
  move,
  volumes,
  unavailable,
  view,
}: StripInput): LibraryStrip {
  if (volumes?.currentAvailable === false)
    return {
      kind: 'missing',
      title: cardMissingTitle(volumes.currentVolumeUuid),
      detail: missingDetail(unavailable, view),
    };
  return move === null ? { kind: 'none' } : moveStrip(move);
}
