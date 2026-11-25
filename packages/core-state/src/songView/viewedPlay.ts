import type { QueuedSong } from '@kitbag/core-db';

import { isSessionEntry } from '../library/setlistSession.ts';
import type { LibraryStore } from '../library/store.ts';
import type { AdvanceOutcome } from '../stemPlayer/songEnd.ts';

export type ViewLibrary = Pick<
  LibraryStore,
  'session' | 'entries' | 'endSetlistSession'
>;

export function viewedPlay(library: () => ViewLibrary) {
  const writes = new Set<Promise<void>>();
  return {
    track: (write: Promise<unknown>) => {
      const settled = write.then(
        () => undefined,
        () => undefined,
      );
      writes.add(settled);
      void settled.then(() => writes.delete(settled));
    },
    play: async (
      song: QueuedSong,
      takeOver: () => Promise<AdvanceOutcome>,
    ): Promise<AdvanceOutcome> => {
      await Promise.all(writes);
      const state = library();
      if (!isSessionEntry(state, song)) state.endSetlistSession();
      return takeOver();
    },
  };
}
