import {
  GRID_METER,
  NO_METER_OVERRIDE,
  TEMPO_CORRECTION,
  TEMPO_CORRECTIONS,
  type SongRecord,
  type TempoCorrection,
} from '@kitbag/core-db';
import { describe, expect, it, vi } from 'vitest';

import { songRow } from '../storage/fixtures.test-helper.ts';
import { overrideDisagrees } from './songGrid.ts';
import {
  opened,
  openedSong,
  SONG_ID,
  songRecord,
} from './store.test-helper.ts';

const PRECISION = 9;
const BEAT_COUNT = 32;
const BAR_ONE_INDEX = 3;
const DETECTED_METER = 4;

function steadySong(bpm: number, change: Partial<SongRecord> = {}) {
  const spacing = 60 / bpm;
  const beats = Array.from({ length: BEAT_COUNT }, (_, i) => i * spacing);
  const downbeatIndices = beats
    .map((_, i) => i)
    .filter((i) => i >= BAR_ONE_INDEX)
    .filter((i) => (i - BAR_ONE_INDEX) % DETECTED_METER === 0);
  return songRecord({ bpm, beats, downbeatIndices, ...change });
}

const BAR_ONE_SONG = steadySong(120);
const BAR_ONE_SECONDS = BAR_ONE_SONG.beats[BAR_ONE_INDEX] ?? Number.NaN;

type Player = Awaited<ReturnType<typeof openedSong>>['store'];

function downbeatTimes(store: Player): number[] {
  const { beats, downbeatIndices } = store.getState();
  return downbeatIndices.map((i) => beats[i] ?? Number.NaN);
}

function isDownbeat(store: Player, seconds: number): boolean {
  return downbeatTimes(store).some(
    (time) => Math.abs(time - seconds) < 10 ** -PRECISION,
  );
}

async function corrected(song: SongRecord, correction: TempoCorrection) {
  const { store } = await openedSong(song);
  store.getState().tempoCorrectionChanged(SONG_ID, correction);
  return store;
}

describe('bar 1 on a corrected grid', () => {
  it.each(TEMPO_CORRECTIONS)(
    '%s keeps the detected bar 1 and meter',
    async (correction) => {
      const store = await corrected(BAR_ONE_SONG, correction);
      const { detected } = store.getState();
      expect(detected.meter).toBe(DETECTED_METER);
      expect(detected.barOneSeconds).toBeCloseTo(BAR_ONE_SECONDS, PRECISION);
      expect(isDownbeat(store, BAR_ONE_SECONDS)).toBe(true);
    },
  );

  it.each([TEMPO_CORRECTION.double, TEMPO_CORRECTION.threeHalves])(
    '%s keeps bar 1 a downbeat under a meter-only override',
    async (correction) => {
      const store = await corrected(
        { ...BAR_ONE_SONG, meterBeatsPerBar: GRID_METER.triple },
        correction,
      );
      expect(isDownbeat(store, BAR_ONE_SECONDS)).toBe(true);
    },
  );

  it('reports the detected bar 1 under a bar 1 override', async () => {
    const moved = BAR_ONE_SONG.beats[BAR_ONE_INDEX + 2] ?? Number.NaN;
    const store = await corrected(
      { ...BAR_ONE_SONG, barOneSeconds: moved },
      TEMPO_CORRECTION.double,
    );
    expect(store.getState().detected.barOneSeconds).toBeCloseTo(
      BAR_ONE_SECONDS,
      PRECISION,
    );
    expect(isDownbeat(store, moved)).toBe(true);
  });
});

describe('the detected bar 1 under a user bar 1', () => {
  const ONE_BEAT_LATER = BAR_ONE_SONG.beats[BAR_ONE_INDEX + 1] ?? Number.NaN;

  it.each([
    TEMPO_CORRECTION.half,
    TEMPO_CORRECTION.threeHalves,
    TEMPO_CORRECTION.twoThirds,
  ])('%s still reports the analysed bar 1', async (correction) => {
    const store = await corrected(
      { ...BAR_ONE_SONG, barOneSeconds: ONE_BEAT_LATER },
      correction,
    );
    expect(store.getState().detected.barOneSeconds).toBe(BAR_ONE_SECONDS);
  });
});

describe('an override that disagrees with a corrected grid', () => {
  it('compares downbeat times, not indices into differently anchored grids', () => {
    const userBarOne = BAR_ONE_SONG.beats[10] ?? Number.NaN;
    expect(
      overrideDisagrees({
        ...BAR_ONE_SONG,
        barOneSeconds: userBarOne,
        tempoCorrection: TEMPO_CORRECTION.half,
      }),
    ).toBe(true);
  });
});

describe('a song analysed at double its felt tempo', () => {
  const MAIN_THING_DRUMS = steadySong(185);
  const FELT_BPM = 92.5;

  it('halves 185 to 92.5 BPM and keeps bar 1 and the meter', async () => {
    const barOne = MAIN_THING_DRUMS.beats[BAR_ONE_INDEX] ?? Number.NaN;
    const store = await corrected(MAIN_THING_DRUMS, TEMPO_CORRECTION.half);
    const { bpm, detected, downbeatIndices } = store.getState();
    expect(bpm).toBe(FELT_BPM);
    expect(detected.meter).toBe(DETECTED_METER);
    expect(detected.barOneSeconds).toBeCloseTo(barOne, PRECISION);
    expect(isDownbeat(store, barOne)).toBe(true);
    const bars = downbeatIndices
      .slice(1)
      .map((i, n) => i - (downbeatIndices[n] ?? 0));
    expect(new Set(bars)).toEqual(new Set([DETECTED_METER]));
  });
});

describe('re-analysing a corrected song', () => {
  it('reports the new detected bar 1 and notes it against the override', async () => {
    const first = {
      ...BAR_ONE_SONG,
      tempoCorrection: TEMPO_CORRECTION.double,
      meterBeatsPerBar: GRID_METER.triple,
    };
    const shifted = 1;
    const reanalysed: SongRecord = {
      ...first,
      downbeatIndices: BAR_ONE_SONG.downbeatIndices.map((i) => i + shifted),
    };
    const newBarOne = BAR_ONE_SONG.beats[BAR_ONE_INDEX + shifted] ?? Number.NaN;
    const { player, library, ...fake } = await opened(first);
    fake.records.readSong.mockResolvedValue(reanalysed);
    library.setState({ rows: [songRow({ id: SONG_ID, bpm: 121 })] });
    await vi.waitFor(() => {
      expect(player.getState().meterNotice).not.toBeNull();
    });
    const { detected, meterNotice, meterOverride } = player.getState();
    expect(detected.meter).toBe(DETECTED_METER);
    expect(detected.barOneSeconds).toBeCloseTo(newBarOne, PRECISION);
    expect(meterNotice).toEqual(detected);
    expect(meterOverride).toEqual({
      ...NO_METER_OVERRIDE,
      meterBeatsPerBar: GRID_METER.triple,
    });
  });
});
