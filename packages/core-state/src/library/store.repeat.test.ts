import { afterEach, describe, expect, it } from 'vitest';

import { REPEAT, repeatStore } from '../playOrder/repeat.ts';
import { SONG_STEP } from './setlistPosition.ts';
import { isPresetEntry } from './snapshot.ts';
import type { createLibraryStore } from './store.ts';
import { setup } from './store.test-helper.ts';

afterEach(() => {
  repeatStore.setState({ mode: REPEAT.off });
});

type Library = ReturnType<typeof createLibraryStore>;

const loadedName = (library: Library) =>
  library
    .getState()
    .presets.find((p) => p.id === library.getState().loaded?.presetId)?.name;

async function onFirstSong() {
  const { library } = setup();
  const s = library.getState();
  const gig = await s.createSetlist('Gig');
  for (const name of ['One', 'Two', 'Three'])
    await s.newSongFromCurrent(name, gig);
  const [first] = (library.getState().entries[gig] ?? []).filter(isPresetEntry);
  if (first === undefined) throw new Error('missing first song');
  await s.loadSong(first.preset.id, first.item.id, gig);
  return library;
}

describe('the Metronome setlist keys under Repeat all', () => {
  it('load the last song on Previous from song 1, and song 1 on Next from the last', async () => {
    const library = await onFirstSong();
    repeatStore.setState({ mode: REPEAT.all });
    await library.getState().stepSong(SONG_STEP.previous);
    expect(loadedName(library)).toBe('Three');
    await library.getState().stepSong(SONG_STEP.next);
    expect(loadedName(library)).toBe('One');
  });

  it.each([REPEAT.off, REPEAT.one])(
    'stop at both ends with %s',
    async (mode) => {
      const library = await onFirstSong();
      repeatStore.setState({ mode });
      await library.getState().stepSong(SONG_STEP.previous);
      expect(loadedName(library)).toBe('One');
    },
  );
});
