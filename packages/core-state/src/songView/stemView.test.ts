import type { StemSetRecord } from '@kitbag/core-db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMixerClaim } from '../stemPlayer/mixerClaim.ts';
import { ADVANCE_OUTCOME } from '../stemPlayer/songEnd.ts';
import { createStemPlayerStore } from '../stemPlayer/store.ts';
import {
  at,
  BARS,
  fakeRuntime,
  record,
  SAVE_MS,
  SEEK_MS,
  SONG_DETAILS,
  stem,
} from '../stemPlayer/store.test-helper.ts';
import { createStemViewStore } from './stemView.ts';
import { engineCalls, startedSetlist } from './view.test-helper.ts';
import type { ViewLibrary } from './viewedPlay.ts';

const PLAYING = 7;
const OTHER = 9;
const SLOWED = 0.75;
const UP_TWO = 2;
const HALF_GAIN = 0.5;
const VERSE = 1;
const VERSE_START = 4;
const VERSE_END = 8;

function twoStemSongs() {
  const other = record([stem(3), stem(4, { role: 'drums' })], {
    ...SONG_DETAILS,
    id: OTHER,
    title: 'Other',
  });
  const fake = fakeRuntime(other);
  const readStemSet = vi.fn((id: number) =>
    id === OTHER
      ? fake.records.readStemSet()
      : Promise.resolve<StemSetRecord | undefined>(record([stem(1), stem(2)])),
  );
  const runtime = {
    ...fake.runtime,
    records: { ...fake.records, readStemSet },
  };
  fake.commands.mixerStop.mockImplementation(() => {
    fake.engine.playing = false;
  });
  return { ...fake, runtime, readStemSet };
}

type Songs = ReturnType<typeof twoStemSongs>;

async function playing(songs: Songs, library: ViewLibrary) {
  const player = createStemPlayerStore(() => songs.runtime, {
    mixSaveDelayMs: SAVE_MS,
    scrubSeekDelayMs: SEEK_MS,
    mixerClaim: createMixerClaim(),
  });
  const hold = player.getState().acquireSong(PLAYING, BARS);
  await vi.waitFor(() => {
    expect(player.getState().status).toBe('ready');
  });
  player.getState().togglePlay();
  songs.engine.playing = true;
  hold.release();
  const view = createStemViewStore({
    runtimeOf: () => songs.runtime,
    player: () => player.getState(),
    library: () => library,
    mixSaveDelayMs: SAVE_MS,
  });
  vi.clearAllMocks();
  return { player, view };
}

describe('viewing a stem song while another plays', () => {
  let songs: Songs;
  beforeEach(() => {
    songs = twoStemSongs();
  });

  it('reads the song from the library without touching the engine', async () => {
    const { player, view } = await playing(songs, startedSetlist());
    await view.getState().view(OTHER, BARS);
    expect(view.getState()).toMatchObject({
      status: 'ready',
      setId: OTHER,
      title: 'Other',
    });
    expect(view.getState().stems.map((row) => row.id)).toEqual([3, 4]);
    expect(view.getState().sections).toHaveLength(
      SONG_DETAILS.sections?.length ?? 0,
    );
    expect(songs.runtime.readWaveform).toHaveBeenCalled();
    expect(engineCalls(songs.commands)).toEqual([]);
    expect(player.getState()).toMatchObject({
      status: 'ready',
      setId: PLAYING,
    });
  });

  it('saves speed and key changes without touching the engine', async () => {
    const { view } = await playing(songs, startedSetlist());
    await view.getState().view(OTHER, BARS);
    await view.getState().setSpeed(SLOWED);
    await view.getState().setSongKey(UP_TWO);
    expect(songs.records.saveStemSetSpeedKey).toHaveBeenLastCalledWith(OTHER, {
      speed: SLOWED,
      pitch: UP_TWO,
      stems: [
        { id: 3, pitch: UP_TWO },
        { id: 4, pitch: 0 },
      ],
    });
    expect(engineCalls(songs.commands)).toEqual([]);
  });

  it('saves mix and click changes without touching the engine', async () => {
    const { view } = await playing(songs, startedSetlist());
    await view.getState().view(OTHER, BARS);
    view.getState().setGain(0, HALF_GAIN);
    view.getState().toggleMute(1);
    await view.getState().setClickRate('double');
    expect(songs.records.saveStemSetClick).toHaveBeenCalledWith(OTHER, {
      clickRate: 'double',
    });
    await vi.waitFor(() => {
      expect(songs.records.saveStemMix).toHaveBeenCalledWith([
        { id: 3, volume: HALF_GAIN, muted: false, soloed: false },
        { id: 4, volume: 1, muted: true, soloed: false },
      ]);
    });
    expect(engineCalls(songs.commands)).toEqual([]);
  });

  it('stores the mix before Play reads the song', async () => {
    const { view } = await playing(songs, startedSetlist());
    await view.getState().view(OTHER, BARS);
    view.getState().setGain(0, HALF_GAIN);
    await view.getState().play();
    const [saved] = songs.records.saveStemMix.mock.invocationCallOrder;
    const read = songs.readStemSet.mock.invocationCallOrder.at(-1);
    expect(saved).toBeLessThan(read ?? 0);
    expect(songs.commands.mixerSetGain).toHaveBeenCalledWith(0, HALF_GAIN);
  });

  it('holds a section loop until Play, then applies it before playing', async () => {
    const { player, view } = await playing(songs, startedSetlist());
    await view.getState().view(OTHER, BARS);
    await view.getState().loopSection(VERSE);
    expect(view.getState()).toMatchObject({
      startSec: VERSE_START,
      loop: { kind: 'on', startSec: VERSE_START, endSec: VERSE_END },
    });
    expect(engineCalls(songs.commands)).toEqual([]);

    expect(await view.getState().play()).toBe(ADVANCE_OUTCOME.playing);

    const { mixerSetLoop, mixerSeek, mixerPlay } = songs.commands;
    expect(player.getState().setId).toBe(OTHER);
    expect(mixerSetLoop).toHaveBeenCalledWith(at(VERSE_START), at(VERSE_END));
    expect(mixerSeek).toHaveBeenLastCalledWith(at(VERSE_START));
    const [played] = mixerPlay.mock.invocationCallOrder;
    expect(mixerSeek.mock.invocationCallOrder.at(-1)).toBeLessThan(played ?? 0);
  });
});

describe('the setlist on Play from a viewed stem song', () => {
  let songs: Songs;
  beforeEach(() => {
    songs = twoStemSongs();
  });

  it('stays when the song is only viewed', async () => {
    const library = startedSetlist({ kind: 'stems', id: PLAYING });
    const { view } = await playing(songs, library);
    await view.getState().view(OTHER, BARS);
    expect(library.endSetlistSession).not.toHaveBeenCalled();
  });

  it('ends when the played song is not in it', async () => {
    const library = startedSetlist({ kind: 'stems', id: PLAYING });
    const { view } = await playing(songs, library);
    await view.getState().view(OTHER, BARS);
    await view.getState().play();
    expect(library.endSetlistSession).toHaveBeenCalledOnce();
  });

  it('stays when the played song is one of its entries', async () => {
    const library = startedSetlist(
      { kind: 'stems', id: PLAYING },
      { kind: 'stems', id: OTHER },
    );
    const { view } = await playing(songs, library);
    await view.getState().view(OTHER, BARS);
    await view.getState().play();
    expect(library.endSetlistSession).not.toHaveBeenCalled();
  });
});
