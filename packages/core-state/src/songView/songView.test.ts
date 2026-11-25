import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BARS, SONG_ID, songRecord } from '../songPlayer/store.test-helper.ts';
import { ADVANCE_OUTCOME } from '../stemPlayer/songEnd.ts';
import { at } from '../stemPlayer/store.test-helper.ts';
import {
  OTHER,
  playing,
  twoSongs,
  type Songs,
  type View,
} from './songView.test-helper.ts';
import { engineCalls, startedSetlist } from './view.test-helper.ts';

const SLOWED = 0.9;
const LOOP_START = 1;
const LOOP_END = 2;
const HELD_START = 1.5;
const ONE_BAR = 1;
const SOUND_A = 1;
const SOUND_B = 2;

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

  it.each([
    [
      'accent',
      (view: View) => {
        view.getState().cycleClickAccent(0);
      },
    ],
    [
      'sounds',
      (view: View) => {
        view.getState().setClickSounds(SOUND_A, SOUND_B);
      },
    ],
    [
      'count-in',
      (view: View) => {
        view.getState().setClickCountIn(ONE_BAR);
      },
    ],
  ])('saves a click %s edit for the viewed song', async (_, edit) => {
    const { view } = await playing(songs, startedSetlist());
    await view.getState().view(OTHER, BARS);
    edit(view);
    await vi.waitFor(() => {
      expect(songs.records.saveForLibrarySong).toHaveBeenCalledWith(
        OTHER,
        expect.anything(),
      );
    });
    expect(engineCalls(songs.metronome.commands)).toEqual([]);
    expect(engineCalls(songs.commands)).toEqual([]);
  });

  it('shows the click a saved song preset turns on, without the engine', async () => {
    const { view } = await playing(songs, startedSetlist());
    await view.getState().view(OTHER, BARS);
    expect(view.getState().click).toBe(false);
    view.getState().setClickCountIn(ONE_BAR);
    await vi.waitFor(() => {
      expect(songs.records.saveForLibrarySong).toHaveBeenCalled();
    });
    await view.getState().view(OTHER, BARS);
    expect(view.getState().click).toBe(true);
    view.getState().cycleClickAccent(0);
    expect(engineCalls(songs.metronome.commands)).toEqual([]);
    expect(engineCalls(songs.commands)).toEqual([]);
  });

  it('keeps a held seek past the first bar when the song has a count-in', async () => {
    const { view } = await playing(songs, startedSetlist());
    await view.getState().view(OTHER, BARS);
    view.getState().setClickCountIn(ONE_BAR);
    view.getState().seek(at(HELD_START));
    expect(await view.getState().play()).toBe(ADVANCE_OUTCOME.playing);
    expect(songs.commands.mixerSeek).toHaveBeenLastCalledWith(at(HELD_START));
    expect(songs.commands.songCountIn).not.toHaveBeenCalled();
    expect(songs.commands.mixerPlay).toHaveBeenCalled();
  });

  it('moves the held start on the scrub release, not while it drags', async () => {
    const { view } = await playing(songs, startedSetlist());
    await view.getState().view(OTHER, BARS);
    view.getState().scrub(at(LOOP_END));
    expect(view.getState().startSec).toBe(0);
    view.getState().seek(at(LOOP_END));
    expect(view.getState().startSec).toBe(LOOP_END);
  });

  it('keeps the loop when a held seek leaves it', async () => {
    const { view } = await playing(songs, startedSetlist());
    await view.getState().view(OTHER, BARS);
    view.getState().seek(at(LOOP_START));
    await view.getState().markLoop();
    view.getState().seek(at(LOOP_END));
    await view.getState().markLoop();
    view.getState().seek(0);
    expect(view.getState().loop.kind).toBe('on');
  });

  it('plays the song once when the view is left mid-Play', async () => {
    const library = startedSetlist();
    const { player, view } = await playing(songs, library);
    await view.getState().view(OTHER, BARS);
    const played = view.getState().play();
    view.getState().leave();
    expect(await played).toBe(ADVANCE_OUTCOME.playing);
    expect(player.getState()).toMatchObject({ status: 'ready', songId: OTHER });
    expect(view.getState().status).toBe('idle');
    expect(songs.commands.mixerStop).toHaveBeenCalledOnce();
    expect(songs.commands.mixerPlay).toHaveBeenCalledOnce();
    expect(library.endSetlistSession).toHaveBeenCalledOnce();
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

  it('stays when the viewed song cannot play', async () => {
    const library = startedSetlist({ kind: 'song', id: SONG_ID });
    const { view } = await playing(songs, library);
    await view.getState().view(OTHER, BARS);
    songs.readSong.mockResolvedValueOnce(undefined);
    expect(await view.getState().play()).toBe(ADVANCE_OUTCOME.unplayable);
    expect(library.endSetlistSession).not.toHaveBeenCalled();
  });
});
