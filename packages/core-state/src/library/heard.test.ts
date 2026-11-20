import type { QueuedSong } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';
import { createStore } from 'zustand/vanilla';

import {
  droppedTrailing,
  heardAfter,
  setlistSessionActions,
  type HeardSong,
} from './setlistSession.ts';
import type { LibraryStore } from './store.ts';

const NIGHT_BUS: QueuedSong = { kind: 'stems', id: 21 };
const HUM: QueuedSong = { kind: 'song', id: 41 };
const plain = (song: QueuedSong): HeardSong => ({ song, setlistItemId: null });

describe('the songs heard this listening session', () => {
  it('adds a song once however often it shows again in a row', () => {
    const heard = heardAfter(heardAfter([], plain(HUM)), plain(HUM));
    expect(heard).toEqual([plain(HUM)]);
    expect(heardAfter(heard, plain(NIGHT_BUS))).toEqual([
      plain(HUM),
      plain(NIGHT_BUS),
    ]);
  });

  it('forgets only the song left at the end', () => {
    const heard = [plain(HUM), plain(NIGHT_BUS), plain(HUM)];
    expect(droppedTrailing(heard, HUM)).toEqual([plain(HUM), plain(NIGHT_BUS)]);
    expect(droppedTrailing(heard, NIGHT_BUS)).toEqual(heard);
  });

  it('is cleared when the listening session ends', () => {
    const store = createStore<LibraryStore>(
      () =>
        ({
          session: { setlistId: 5, skipped: [] },
          heard: [plain(HUM), plain(NIGHT_BUS)],
        }) as unknown as LibraryStore,
    );
    const actions = setlistSessionActions(store.setState, store.getState, {
      pin: () => Promise.resolve(),
      leave: () => Promise.resolve(),
    });
    actions.endListeningSession();
    expect(store.getState()).toMatchObject({ session: null, heard: [] });
  });
});
