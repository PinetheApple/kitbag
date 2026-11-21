import {
  GRID_METER,
  TEMPO_CORRECTION,
  TEMPO_MODE,
  TEMPO_SOURCE,
  type BundleTempo,
  type LibraryRow,
  type SongRecord,
} from '@kitbag/core-db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { songRow } from '../storage/fixtures.test-helper.ts';
import { tempoGrid } from '../stemPlayer/tempoGrid.ts';
import {
  opened,
  openedSong,
  SONG_ID,
  songRecord,
} from './store.test-helper.ts';

const DETECTED_BPM = 109;
const FITTED_BPM = 128;
const DURATION_SEC = 4;
const DRIFTING_BEATS = [0, 0.55, 1.1, 1.65, 2.2, 2.75, 3.3, 3.85];
const FIT: BundleTempo = {
  mode: TEMPO_MODE.follow,
  bpm: FITTED_BPM,
  anchor: 0,
  beatsPerBar: GRID_METER.triple,
  source: TEMPO_SOURCE.analysed,
};
const UNTIMED: BundleTempo = { ...FIT, bpm: null, anchor: null };

const SONG = songRecord({
  bpm: DETECTED_BPM,
  durationSec: DURATION_SEC,
  beats: DRIFTING_BEATS,
  downbeatIndices: [0, 3, 6],
  tempo: FIT,
});

const constantGrid = () =>
  tempoGrid(SONG, FIT, TEMPO_MODE.constant, DURATION_SEC);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('opening a song Kitbag fitted a tempo to', () => {
  it('plays the analysed beats, following the band', async () => {
    const { store } = await openedSong(SONG);
    expect(store.getState()).toMatchObject({
      tempo: FIT,
      tempoMode: TEMPO_MODE.follow,
      beats: DRIFTING_BEATS,
      downbeatIndices: [0, 3, 6],
      bpm: DETECTED_BPM,
    });
  });

  it('plays the constant grid once constant was chosen', async () => {
    const { store } = await openedSong({
      ...SONG,
      chosenTempoMode: TEMPO_MODE.constant,
    });
    expect(constantGrid().beats).not.toEqual(DRIFTING_BEATS);
    expect(store.getState()).toMatchObject({
      tempoMode: TEMPO_MODE.constant,
      beats: constantGrid().beats,
      downbeatIndices: constantGrid().downbeatIndices,
      bpm: FITTED_BPM,
      detectedBpm: FITTED_BPM,
    });
  });

  it('corrects the constant grid by the saved factor', async () => {
    const { store } = await openedSong({
      ...SONG,
      chosenTempoMode: TEMPO_MODE.constant,
      tempoCorrection: TEMPO_CORRECTION.double,
    });
    expect(store.getState().bpm).toBe(FITTED_BPM * 2);
    expect(store.getState().beats.length).toBeGreaterThan(
      constantGrid().beats.length,
    );
  });

  it('opens with no tempo mode for a song with no fit', async () => {
    const { store } = await openedSong({ ...SONG, tempo: null });
    expect(store.getState().tempoMode).toBeNull();
  });
});

describe("switching a song's tempo mode", () => {
  it('plays, stores and clicks the constant grid', async () => {
    const { store, records, commands } = await openedSong(SONG);
    await store.getState().toggleClick();
    await store.getState().setTempoMode(TEMPO_MODE.constant);
    await vi.runAllTimersAsync();
    expect(store.getState()).toMatchObject({
      tempoMode: TEMPO_MODE.constant,
      beats: constantGrid().beats,
      bpm: FITTED_BPM,
    });
    expect(records.saveSongChosenTempoMode).toHaveBeenCalledWith(
      SONG_ID,
      TEMPO_MODE.constant,
    );
    expect(commands.setGrid.mock.lastCall?.[0]).toEqual(constantGrid().beats);
  });

  it('switches back to the analysed beats', async () => {
    const { store } = await openedSong({
      ...SONG,
      chosenTempoMode: TEMPO_MODE.constant,
    });
    await store.getState().setTempoMode(TEMPO_MODE.follow);
    expect(store.getState()).toMatchObject({
      beats: DRIFTING_BEATS,
      bpm: DETECTED_BPM,
    });
  });

  it('is refused when the fit found no steady tempo', async () => {
    const { store, records } = await openedSong({ ...SONG, tempo: UNTIMED });
    await store.getState().setTempoMode(TEMPO_MODE.constant);
    expect(store.getState().beats).toEqual(DRIFTING_BEATS);
    expect(records.saveSongChosenTempoMode).not.toHaveBeenCalled();
  });

  it('goes back to the grid it replaced when the choice does not store', async () => {
    const { store, records } = await openedSong(SONG);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    records.saveSongChosenTempoMode.mockRejectedValueOnce(new Error('disk'));
    await store.getState().setTempoMode(TEMPO_MODE.constant);
    expect(store.getState()).toMatchObject({
      tempoMode: TEMPO_MODE.follow,
      beats: DRIFTING_BEATS,
      bpm: DETECTED_BPM,
    });
  });
});

describe('a song re-read while its tempo mode saves', () => {
  async function rereadWhileSaving(stored: SongRecord) {
    const song = await opened(SONG);
    let finish: () => void = () => undefined;
    song.records.saveSongChosenTempoMode.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const switching = song.player.getState().setTempoMode(TEMPO_MODE.constant);
    song.records.readSong.mockResolvedValue(stored);
    song.library.setState({
      rows: [songRow({ id: SONG_ID })] as readonly LibraryRow[],
    });
    await vi.runAllTimersAsync();
    finish();
    await switching;
    return song.player.getState();
  }

  it('keeps the switch over the row read before it stored', async () => {
    expect(await rereadWhileSaving(SONG)).toMatchObject({
      tempoMode: TEMPO_MODE.constant,
      beats: constantGrid().beats,
    });
  });

  it('follows a re-analysis that leaves no steady tempo', async () => {
    expect(await rereadWhileSaving({ ...SONG, tempo: UNTIMED })).toMatchObject({
      tempoMode: TEMPO_MODE.follow,
      beats: DRIFTING_BEATS,
    });
  });
});
