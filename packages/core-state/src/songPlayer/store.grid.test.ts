import type { LibraryRow, LibrarySongRow, SongRecord } from '@kitbag/core-db';
import { KB_RESULT } from '@kitbag/core-native';
import { describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';

import { songRow } from '../storage/fixtures.test-helper.ts';
import {
  BARS,
  fakeSongRuntime,
  SONG_ID,
  songRecord,
  songStore,
} from './store.test-helper.ts';

const ANALYSING = songRecord({
  analysisStatus: 'analyzing',
  bpm: null,
  beats: [],
  downbeatIndices: [],
  waveformPath: null,
});
const LANDED = songRecord();
const REPLACED = songRecord({
  bpm: 121,
  beats: [0.1, 0.6, 1.1, 1.6, 2.1],
  downbeatIndices: [1],
  waveformPath: 'songs/u/everlong-2.kwav',
});

function rowOf(song: SongRecord): LibrarySongRow {
  return songRow({
    id: song.id,
    title: song.title,
    bpm: song.bpm,
    hasGrid: song.beats.length > 0,
    analysisStatus: song.analysisStatus,
  });
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function playing(first: SongRecord) {
  const fake = fakeSongRuntime(first);
  const library = createStore(() => ({
    rows: [rowOf(first)] as readonly LibraryRow[],
    ready: true,
    failed: false,
  }));
  const player = songStore(fake, undefined, library);
  await player.getState().open(SONG_ID, BARS).loaded;
  player.getState().togglePlay();
  return { ...fake, library, player };
}

type Playing = Awaited<ReturnType<typeof playing>>;

function storeAnalysis({ records, library }: Playing, song: SongRecord) {
  records.readSong.mockResolvedValue(song);
  library.setState({ rows: [rowOf(song)] });
}

function heldRead(song: Playing) {
  let answer: (record: SongRecord) => void = () => undefined;
  song.records.readSong.mockImplementationOnce(
    () =>
      new Promise<SongRecord>((resolve) => {
        answer = resolve;
      }),
  );
  song.library.setState({ rows: [rowOf(REPLACED)] });
  return (record: SongRecord) => {
    answer(record);
  };
}

function expectNoReload({ commands }: Playing) {
  expect(commands.loadTrack).toHaveBeenCalledOnce();
  expect(commands.mixerUnloadTrack).not.toHaveBeenCalled();
  expect(commands.mixerSeek).not.toHaveBeenCalled();
  expect(commands.mixerStop).not.toHaveBeenCalled();
  expect(commands.mixerPause).not.toHaveBeenCalled();
}

describe('a grid landing on the open song', () => {
  it('shows the analysis without reloading the playing track', async () => {
    const song = await playing(ANALYSING);
    expect(song.player.getState().envelope).toBeNull();
    storeAnalysis(song, LANDED);
    await vi.waitFor(() => {
      expect(song.player.getState().beats).toEqual(LANDED.beats);
    });
    await vi.waitFor(() => {
      expect(song.player.getState().envelope).toEqual([0.5]);
    });
    expect(song.player.getState()).toMatchObject({
      status: 'ready',
      analysisStatus: 'done',
      bpm: LANDED.bpm,
      downbeatIndices: LANDED.downbeatIndices,
      click: false,
    });
    expect(song.readWaveform).toHaveBeenCalledWith(LANDED.waveformPath, BARS);
    expect(song.commands.setGrid).not.toHaveBeenCalled();
    expectNoReload(song);
  });

  it('never shows the new status without its grid', async () => {
    const song = await playing(ANALYSING);
    const seen: [string, number][] = [];
    song.player.subscribe(({ analysisStatus, beats }) => {
      seen.push([analysisStatus, beats.length]);
    });
    storeAnalysis(song, LANDED);
    await vi.waitFor(() => {
      expect(song.player.getState().beats).toEqual(LANDED.beats);
    });
    expect(seen).not.toContainEqual(['done', 0]);
  });
});

describe('a grid replaced on an analysed song', () => {
  it('sends the new grid to a running click, keeping the track', async () => {
    const song = await playing(LANDED);
    await song.player.getState().toggleClick();
    storeAnalysis(song, REPLACED);
    await vi.waitFor(() => {
      expect(song.commands.setGrid).toHaveBeenLastCalledWith(
        REPLACED.beats,
        REPLACED.downbeatIndices,
        0,
      );
    });
    expect(song.player.getState()).toMatchObject({
      click: true,
      bpm: REPLACED.bpm,
      beats: REPLACED.beats,
    });
    expect(song.readWaveform).toHaveBeenLastCalledWith(
      REPLACED.waveformPath,
      BARS,
    );
    expectNoReload(song);
  });

  it('leaves a click that is off, off', async () => {
    const song = await playing(LANDED);
    storeAnalysis(song, REPLACED);
    await vi.waitFor(() => {
      expect(song.player.getState().beats).toEqual(REPLACED.beats);
    });
    expect(song.player.getState().click).toBe(false);
    expect(song.commands.setGrid).not.toHaveBeenCalled();
  });

  it('turns the click off when the new analysis has no beats', async () => {
    const song = await playing(LANDED);
    await song.player.getState().toggleClick();
    storeAnalysis(song, songRecord({ beats: [], downbeatIndices: [] }));
    await vi.waitFor(() => {
      expect(song.player.getState().click).toBe(false);
    });
    expect(song.commands.clearGrid).toHaveBeenCalled();
    expect(song.commands.setGrid).toHaveBeenCalledOnce();
  });

  it('turns the click off when the engine refuses the new grid', async () => {
    const song = await playing(LANDED);
    await song.player.getState().toggleClick();
    song.commands.setGrid.mockResolvedValueOnce(
      KB_RESULT.KB_ERROR_INVALID_ARGUMENT,
    );
    storeAnalysis(song, REPLACED);
    await vi.waitFor(() => {
      expect(song.player.getState().click).toBe(false);
    });
  });

  it('resends nothing when the library changes around the same grid', async () => {
    const song = await playing(LANDED);
    await song.player.getState().toggleClick();
    storeAnalysis(song, songRecord({ bpm: 119 }));
    await vi.waitFor(() => {
      expect(song.player.getState().bpm).toBe(119);
    });
    expect(song.commands.setGrid).toHaveBeenCalledOnce();
    expect(song.readWaveform).toHaveBeenCalledOnce();
  });

  it('follows a grid that lands while the click is turning on', async () => {
    const song = await playing(LANDED);
    let answer: (result: number) => void = () => undefined;
    song.commands.setGrid.mockImplementationOnce(
      () =>
        new Promise<number>((resolve) => {
          answer = resolve;
        }),
    );
    const turningOn = song.player.getState().toggleClick();
    storeAnalysis(song, REPLACED);
    await vi.waitFor(() => {
      expect(song.player.getState().beats).toEqual(REPLACED.beats);
    });
    answer(KB_RESULT.KB_OK);
    await turningOn;
    expect(song.commands.setGrid).toHaveBeenLastCalledWith(
      REPLACED.beats,
      REPLACED.downbeatIndices,
      0,
    );
    expect(song.player.getState().click).toBe(true);
  });
});

describe('a re-read that outlives its session', () => {
  const OTHER = songRecord({
    id: SONG_ID + 1,
    title: 'Monkey Wrench',
    beats: [0.2, 0.7, 1.2],
    downbeatIndices: [0],
  });

  it('changes nothing once the song is closed', async () => {
    const song = await playing(LANDED);
    await song.player.getState().toggleClick();
    const answer = heldRead(song);
    await vi.waitFor(() => {
      expect(song.records.readSong).toHaveBeenCalledTimes(2);
    });
    song.player.getState().close();
    answer(REPLACED);
    await settle();
    expect(song.player.getState()).toMatchObject({ songId: null, beats: [] });
    expect(song.commands.setGrid).toHaveBeenCalledOnce();
  });

  it('leaves the next song alone', async () => {
    const song = await playing(LANDED);
    const answer = heldRead(song);
    await vi.waitFor(() => {
      expect(song.records.readSong).toHaveBeenCalledTimes(2);
    });
    song.records.readSong.mockResolvedValue(OTHER);
    await song.player.getState().open(OTHER.id, BARS).loaded;
    answer(REPLACED);
    await settle();
    expect(song.player.getState()).toMatchObject({
      songId: OTHER.id,
      title: OTHER.title,
      beats: OTHER.beats,
    });
    expect(song.commands.setGrid).not.toHaveBeenCalled();
  });
});
