import { describe, expect, it, vi } from 'vitest';

import { fakeFiles, fakeFitter, fakeOpenSong } from './store.test-helper.ts';
import { createSongLibraryStore } from './store.ts';

const UNOPENED = new Error('The database could not be opened: newer-version');

function libraryWithoutDatabase() {
  const fake = fakeFiles();
  const player = fakeOpenSong();
  return createSongLibraryStore({
    records: () => {
      throw UNOPENED;
    },
    files: () => fake.files,
    newUuid: () => 'f1',
    openSong: () => player.openSong,
    fitTempo: () => fakeFitter(),
    now: () => Date.now(),
  });
}

describe('song library start without a database', () => {
  it('still rejects, and marks the library failed so Home can say so', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = libraryWithoutDatabase();

    await expect(store.getState().start()).rejects.toBe(UNOPENED);

    expect(store.getState()).toMatchObject({ ready: true, failed: true });
  });
});
