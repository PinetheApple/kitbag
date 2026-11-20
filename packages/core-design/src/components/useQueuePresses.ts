import { useCallback, useMemo } from 'react';

import { QUEUE_TEXT } from '../queueText.ts';
import type { QueueAction } from './useQueueNotices.ts';

export type QueuePress = (queued: boolean) => void;

export interface QueuePresses {
  readonly playNext: QueuePress;
  readonly addToQueue: QueuePress;
}

export interface QueueTarget<Song> {
  readonly song: Song;
  readonly title: string;
}

interface QueueActions<Song> {
  readonly playNext: QueueAction<Song>;
  readonly addToQueue: QueueAction<Song>;
}

export function useQueuePresses<Song>(
  actions: QueueActions<Song>,
  target: QueueTarget<Song> | null,
  close: () => void,
): QueuePresses {
  const pressWith = useCallback(
    (action: QueueAction<Song>): QueuePress =>
      (queued) => {
        close();
        if (target !== null) action({ ...target, queued });
      },
    [close, target],
  );
  return useMemo(
    () => ({
      playNext: pressWith(actions.playNext),
      addToQueue: pressWith(actions.addToQueue),
    }),
    [pressWith, actions.playNext, actions.addToQueue],
  );
}

export function useQueueKeys(presses: QueuePresses, queued: boolean) {
  const { playNext, addToQueue } = presses;
  const pressPlayNext = useCallback(() => {
    playNext(queued);
  }, [playNext, queued]);
  const pressAddToQueue = useCallback(() => {
    addToQueue(queued);
  }, [addToQueue, queued]);
  return {
    playNext: pressPlayNext,
    addToQueue: pressAddToQueue,
    addLabel: queued ? QUEUE_TEXT.moveToEnd : QUEUE_TEXT.addToQueue,
  };
}
