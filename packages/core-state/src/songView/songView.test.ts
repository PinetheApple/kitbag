import type { SongRecord } from '@kitbag/core-db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSongPlayerStore } from '../songPlayer/store.ts';
import {
  BARS,
  fakeSongRuntime,
  SEEK_MS,
  SONG_ID,
  songRecord,
} from '../songPlayer/store.test-helper.ts';
import { ADVANCE_OUTCOME } from '../stemPlayer/songEnd.ts';
import { at } from '../stemPlayer/store.test-helper.ts';
import { createMixerClaim } from '../stemPlayer/mixerClaim.ts';
import { createSongViewStore } from './songView.ts';
import { engineCalls, startedSetlist } from './view.test-helper.ts';
import type { ViewLibrary } from './viewedPlay.ts';

const OTHER = 9;
const SLOWED = 0.9;
const LOOP_START = 1;
const LOOP_END = 2;
const HELD_START = 1.5;

function twoSongs() {
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

type Songs = ReturnType<typeof twoSongs>;

async function playing(songs: Songs, library: ViewLibrary) {
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

describe('viewing a song while another plays', () => {
  let songs: Songs;
  beforeEach(() => {
    songs = twoSongs();
  });

  it('reads the song from the library without touching the engine', async () => {
    const { player, view } = await playing(songs, startedSetlist());
    await view.getState().view(OTHER, BARS);
    expect(view.getState()).toMatchObject({
      status: 'ready',
      songId: OTHER,
      title: 'Other',
      beats: songRecord().beats,
    });
    expect(songs.readWaveform).toHaveBeenCalled();
    expect(engineCalls(songs.commands)).toEqual([]);
    expect(player.getState()).toMatchObject({
      status: 'ready',
      songId: SONG_ID,
    });
  });

  it('saves a speed change without changing the playing rate', async () => {
    const { view } = await playing(songs, startedSetlist());
    await view.getState().view(OTHER, BARS);
    await view.getState().setSpeed(SLOWED);
    expect(view.getState().speed).toBe(SLOWED);
    expect(songs.records.saveSongSpeed).toHaveBeenCalledWith(OTHER, SLOWED);
    expect(engineCalls(songs.commands)).toEqual([]);
  });

  it('saves a click edit for the viewed song', async () => {
    const { view } = await playing(songs, startedSetlist());
    await view.getState().view(OTHER, BARS);
    view.getState().cycleClickAccent(0);
    await vi.waitFor(() => {
      expect(songs.records.saveForLibrarySong).toHaveBeenCalledWith(
        OTHER,
        expect.anything(),
      );
    });
    expect(songs.metronome.commands.setAccent).not.toHaveBeenCalled();
    expect(engineCalls(songs.commands)).toEqual([]);
  });

  it('holds a seek and a loop until Play, then applies them before playing', async () => {
    const { player, view } = await playing(songs, startedSetlist());
    await view.getState().view(OTHER, BARS);
    view.getState().seek(at(LOOP_START));
    await view.getState().markLoop();
    view.getState().seek(at(LOOP_END));
    await view.getState().markLoop();
    view.getState().seek(at(HELD_START));
    expect(view.getState().loop).toEqual({
      kind: 'on',
      startSec: LOOP_START,
      endSec: LOOP_END,
    });
    expect(engineCalls(songs.commands)).toEqual([]);

    expect(await view.getState().play()).toBe(ADVANCE_OUTCOME.playing);

    const { mixerSetLoop, mixerSeek, mixerPlay } = songs.commands;
    expect(player.getState().songId).toBe(OTHER);
    expect(mixerSetLoop).toHaveBeenCalledWith(at(LOOP_START), at(LOOP_END));
    expect(mixerSeek).toHaveBeenLastCalledWith(at(HELD_START));
    const [played] = mixerPlay.mock.invocationCallOrder;
    expect(mixerSeek.mock.invocationCallOrder.at(-1)).toBeLessThan(played ?? 0);
  });
});

describe('the setlist on Play from a viewed song', () => {
  let songs: Songs;
  beforeEach(() => {
    songs = twoSongs();
  });

  it('stays when the song is only viewed', async () => {
    const library = startedSetlist({ kind: 'song', id: SONG_ID });
    const { view } = await playing(songs, library);
    await view.getState().view(OTHER, BARS);
    expect(library.endSetlistSession).not.toHaveBeenCalled();
  });

  it('ends when the played song is not in it', async () => {
    const library = startedSetlist({ kind: 'song', id: SONG_ID });
    const { view } = await playing(songs, library);
    await view.getState().view(OTHER, BARS);
    await view.getState().play();
    expect(library.endSetlistSession).toHaveBeenCalledOnce();
  });

  it('stays when the played song is one of its entries', async () => {
    const library = startedSetlist(
      { kind: 'song', id: SONG_ID },
      { kind: 'song', id: OTHER },
    );
    const { view } = await playing(songs, library);
    await view.getState().view(OTHER, BARS);
    await view.getState().play();
    expect(library.endSetlistSession).not.toHaveBeenCalled();
  });
});
