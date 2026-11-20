import { createSongLibraryRepository } from '@kitbag/core-db/src/song-library-repository';
import { describe, expect, it } from 'vitest';

import { presetFromMetronome } from './presetMapping.ts';
import { setup } from './store.test-helper.ts';

const LINKED = 'Linked click';
const UNLINKED = 'Plain song';

async function linkedAndUnlinked() {
  const fixture = setup();
  const { library, metronome, repos, handle } = fixture;
  const songId = await createSongLibraryRepository(handle).insertSong({
    uuid: 'linked',
    title: 'Library track',
    artist: '',
    filePath: 'songs/linked/a.mp3',
    durationSec: 1,
    format: 'mp3',
  });
  await repos.presets.create({
    ...presetFromMetronome(metronome.getState()),
    name: LINKED,
    librarySongId: songId,
  });
  await library.getState().newSongFromCurrent(UNLINKED);
  await library.getState().refresh();
  return fixture;
}

describe('song-linked presets in metronome song lists', () => {
  it('leaves a linked preset out of All songs and keeps an unlinked one', async () => {
    const { library } = await linkedAndUnlinked();
    expect(library.getState().standalone.map((p) => p.name)).toEqual([
      UNLINKED,
    ]);
  });

  it('counts only unlinked presets on the All songs row', async () => {
    const { library } = await linkedAndUnlinked();
    expect(library.getState().standalone).toHaveLength(1);
  });

  it('offers only unlinked presets in the Add song sheet', async () => {
    const { library } = await linkedAndUnlinked();
    expect(library.getState().songs.map((p) => p.name)).toEqual([UNLINKED]);
  });

  it('leaves a linked preset out of search results', async () => {
    const { library } = await linkedAndUnlinked();
    await library.getState().search('i');
    expect(library.getState().results?.presets.map((p) => p.name)).toEqual([
      UNLINKED,
    ]);
  });
});
