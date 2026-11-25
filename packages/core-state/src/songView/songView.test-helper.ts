import type { SongRecord } from '@kitbag/core-db';
import { vi } from 'vitest';

import { createSongPlayerStore } from '../songPlayer/store.ts';
import {
  BARS,
  fakeSongRuntime,
  SEEK_MS,
  SONG_ID,
  songRecord,
} from '../songPlayer/store.test-helper.ts';
import { createMixerClaim } from '../stemPlayer/mixerClaim.ts';
import { createSongViewStore } from './songView.ts';
import type { ViewLibrary } from './viewedPlay.ts';

export const OTHER = 9;
export function twoSongs() {
  const fake = fakeSongRuntime();
  const other = songRecord({ id: OTHER, title: 'Other', speed: 1 });
  const readSong = vi.fn((id: number) =>
    Promise.resolve<SongRecord | undefined>(
      id === OTHER ? other : songRecord(),
    ),
  );
  const runtime = {
    ...fake.runtime,
    records: { ...fake.records, readSong },
  };
  fake.commands.mixerStop.mockImplementation(() => {
    fake.engine.playing = false;
  });
  return { ...fake, runtime, readSong };
}

export type Songs = ReturnType<typeof twoSongs>;
export type View = ReturnType<typeof createSongViewStore>;

export async function playing(songs: Songs, library: ViewLibrary) {
  const player = createSongPlayerStore(() => songs.runtime, {
    scrubSeekDelayMs: SEEK_MS,
    metronome: songs.metronome,
    mixerClaim: createMixerClaim(),
  });
  const session = player.getState().open(SONG_ID, BARS);
  await session.loaded;
  player.getState().togglePlay();
  songs.engine.playing = true;
  session.hold.release();
  const view = createSongViewStore({
    runtimeOf: () => songs.runtime,
    player: () => player.getState(),
    library: () => library,
    metronome: songs.metronome,
  });
  vi.clearAllMocks();
  return { player, view };
}
