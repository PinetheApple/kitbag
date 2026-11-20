import { useCallback, useMemo } from 'react';

import {
  leftSetlistNotice,
  QUEUE_VERB,
  queueNotice,
  type QueueVerb,
} from '../queueText.ts';
import {
  addedToSetlistNotice,
  type AddedToSetlist,
} from '../setlistPickText.ts';
import type { Notice } from './useNotice.ts';

export interface QueueVerbs<Song> {
  readonly playNext: (song: Song) => Promise<boolean>;
  readonly addToQueue: (song: Song) => Promise<boolean>;
}

export interface QueueRequest<Song> {
  readonly song: Song;
  readonly title: string;
  readonly queued: boolean;
}

export type QueueAction<Song> = (request: QueueRequest<Song>) => void;

export function useQueueNotices<Song>(
  notice: Notice,
  verbs: QueueVerbs<Song>,
  onOpenSetlist: (setlistId: number) => void,
  onOpenQueue: (() => void) | null = null,
) {
  const queueWith = useCallback(
    (verb: QueueVerb): QueueAction<Song> =>
      ({ song, title, queued }) => {
        void verbs[verb](song).then((done) => {
          if (done) notice.show(queueNotice(verb, title, queued, onOpenQueue));
        });
      },
    [verbs, notice, onOpenQueue],
  );
  const playNext = useMemo(() => queueWith(QUEUE_VERB.playNext), [queueWith]);
  const addToQueue = useMemo(
    () => queueWith(QUEUE_VERB.addToQueue),
    [queueWith],
  );
  const added = useCallback(
    (to: AddedToSetlist) => {
      notice.show(addedToSetlistNotice(to, onOpenSetlist));
    },
    [notice, onOpenSetlist],
  );
  return useMemo(
    () => ({ playNext, addToQueue, added }),
    [playNext, addToQueue, added],
  );
}

export function useLeftSetlistNotice<
  Left extends { readonly setlistName: string },
>(notice: Notice, rejoin: (left: Left) => Promise<unknown>) {
  return useCallback(
    (left: Left) => {
      notice.show(
        leftSetlistNotice(left.setlistName, () => {
          void rejoin(left);
        }),
      );
    },
    [notice, rejoin],
  );
}
