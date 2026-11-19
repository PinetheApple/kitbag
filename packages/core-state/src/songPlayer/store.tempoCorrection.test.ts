import {
  GRID_METER,
  NO_METER_OVERRIDE,
  TEMPO_CORRECTION,
  type LibraryRow,
  type SongRecord,
} from '@kitbag/core-db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';

import { songRow } from '../storage/fixtures.test-helper.ts';
import { scaleBeats } from '../stemPlayer/tempoCorrection.ts';
import {
  BARS,
  fakeSongRuntime,
  openedSong,
  SONG_ID,
  songRecord,
  songStore,
} from './store.test-helper.ts';

const DETECTED_BPM = 120;
const BEATS = [0, 0.5, 1, 1.5, 2, 2.5, 3];
const ANALYSED = songRecord({
  bpm: DETECTED_BPM,
  beats: BEATS,
  downbeatIndices: [0, 4],
});
const THREE_HALVES_BEATS = scaleBeats(BEATS, TEMPO_CORRECTION.threeHalves);
const DOUBLE_BEATS = scaleBeats(BEATS, TEMPO_CORRECTION.double);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the song player's tempo correction", () => {
  it('scales the grid and the tempo and resends them to a running click', async () => {
    const { commands, store } = await openedSong(ANALYSED);
    await store.getState().toggleClick();
    store
      .getState()
      .tempoCorrectionChanged(SONG_ID, TEMPO_CORRECTION.threeHalves);
    await vi.runAllTimersAsync();
    expect(store.getState()).toMatchObject({
      tempoCorrection: TEMPO_CORRECTION.threeHalves,
      bpm: DETECTED_BPM * 1.5,
      detectedBpm: DETECTED_BPM,
      beats: THREE_HALVES_BEATS,
      downbeatIndices: [0, 4, 8],
      detected: { meter: 4, barOneSeconds: 0 },
    });
    expect(commands.setGrid).toHaveBeenLastCalledWith(
      THREE_HALVES_BEATS,
      [0, 4, 8],
      0,
    );
  });

  it('puts the analysed grid and tempo back on ×1', async () => {
    const { commands, store } = await openedSong(ANALYSED);
    await store.getState().toggleClick();
    store.getState().tempoCorrectionChanged(SONG_ID, TEMPO_CORRECTION.double);
    store.getState().tempoCorrectionChanged(SONG_ID, TEMPO_CORRECTION.none);
    await vi.runAllTimersAsync();
    expect(store.getState()).toMatchObject({
      tempoCorrection: TEMPO_CORRECTION.none,
      bpm: DETECTED_BPM,
      beats: BEATS,
      downbeatIndices: [0, 4],
    });
    expect(commands.setGrid).toHaveBeenLastCalledWith(BEATS, [0, 4], 0);
  });

  it('ignores a change for another song', async () => {
    const { store } = await openedSong(ANALYSED);
    store
      .getState()
      .tempoCorrectionChanged(SONG_ID + 1, TEMPO_CORRECTION.double);
    expect(store.getState().beats).toEqual(BEATS);
    expect(store.getState().bpm).toBe(DETECTED_BPM);
  });

  it('opens a song with its saved factor applied', async () => {
    const { store } = await openedSong({
      ...ANALYSED,
      tempoCorrection: TEMPO_CORRECTION.double,
    });
    expect(store.getState()).toMatchObject({
      tempoCorrection: TEMPO_CORRECTION.double,
      bpm: DETECTED_BPM * 2,
      beats: DOUBLE_BEATS,
    });
  });

  it('keeps the meter override on the scaled grid', async () => {
    const { store } = await openedSong({
      ...ANALYSED,
      meterBeatsPerBar: GRID_METER.triple,
    });
    store.getState().tempoCorrectionChanged(SONG_ID, TEMPO_CORRECTION.double);
    expect(store.getState().downbeatIndices).toEqual([0, 3, 6, 9, 12]);
    expect(store.getState().meterOverride).toEqual({
      ...NO_METER_OVERRIDE,
      meterBeatsPerBar: GRID_METER.triple,
    });
  });

  it('lands bar 1 on the scaled beat nearest its stored time', async () => {
    const { store } = await openedSong({
      ...ANALYSED,
      meterBeatsPerBar: GRID_METER.triple,
      barOneSeconds: 0.5,
    });
    store.getState().tempoCorrectionChanged(SONG_ID, TEMPO_CORRECTION.double);
    expect(store.getState().downbeatIndices).toEqual([2, 5, 8, 11]);
  });

  it('applies the factor to a meter override picked afterwards', async () => {
    const { store } = await openedSong(ANALYSED);
    store.getState().tempoCorrectionChanged(SONG_ID, TEMPO_CORRECTION.double);
    store.getState().meterOverrideChanged(SONG_ID, {
      ...NO_METER_OVERRIDE,
      meterBeatsPerBar: GRID_METER.triple,
    });
    expect(store.getState().beats).toEqual(DOUBLE_BEATS);
    expect(store.getState().downbeatIndices).toEqual([0, 3, 6, 9, 12]);
  });
});

describe('a re-analysis of a corrected song', () => {
  const REANALYSED = songRecord({
    bpm: 100,
    beats: [0.1, 0.7, 1.3, 1.9],
    downbeatIndices: [0],
    tempoCorrection: TEMPO_CORRECTION.double,
  });

  it('scales the new grid by the kept factor', async () => {
    vi.useRealTimers();
    const first: SongRecord = {
      ...ANALYSED,
      tempoCorrection: TEMPO_CORRECTION.double,
    };
    const fake = fakeSongRuntime(first);
    const library = createStore(() => ({
      rows: [songRow({ id: SONG_ID })] as readonly LibraryRow[],
      ready: true,
      failed: false,
    }));
    const player = songStore(fake, undefined, library);
    await player.getState().open(SONG_ID, BARS).loaded;
    fake.records.readSong.mockResolvedValue(REANALYSED);
    library.setState({ rows: [songRow({ id: SONG_ID, bpm: 100 })] });
    await vi.waitFor(() => {
      expect(player.getState().beats).toEqual(
        scaleBeats(REANALYSED.beats, TEMPO_CORRECTION.double),
      );
    });
    expect(player.getState()).toMatchObject({
      tempoCorrection: TEMPO_CORRECTION.double,
      bpm: 200,
      detectedBpm: 100,
    });
  });
});

describe('a re-read while a picked factor saves', () => {
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('keeps the picked factor until the save settles', async () => {
    vi.useRealTimers();
    const fake = fakeSongRuntime(ANALYSED);
    const library = createStore(() => ({
      rows: [songRow({ id: SONG_ID })] as readonly LibraryRow[],
      ready: true,
      failed: false,
    }));
    const player = songStore(fake, undefined, library);
    await player.getState().open(SONG_ID, BARS).loaded;
    player.getState().tempoCorrectionChanged(SONG_ID, TEMPO_CORRECTION.double);
    fake.records.readSong.mockResolvedValue({
      ...ANALYSED,
      tempoCorrection: TEMPO_CORRECTION.threeHalves,
    });
    library.setState({ rows: [songRow({ id: SONG_ID, bpm: 121 })] });
    await vi.waitFor(() => {
      expect(fake.records.readSong).toHaveBeenCalledTimes(2);
    });
    await tick();
    expect(player.getState()).toMatchObject({
      tempoCorrection: TEMPO_CORRECTION.double,
      beats: DOUBLE_BEATS,
    });
    player.getState().tempoCorrectionSettled(SONG_ID);
    library.setState({ rows: [songRow({ id: SONG_ID, bpm: 122 })] });
    await vi.waitFor(() => {
      expect(player.getState().tempoCorrection).toBe(
        TEMPO_CORRECTION.threeHalves,
      );
    });
    expect(player.getState().beats).toEqual(THREE_HALVES_BEATS);
  });
});
