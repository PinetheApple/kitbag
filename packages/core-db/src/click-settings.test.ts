import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@op-engineering/op-sqlite', () => ({}));

import { CLICK_RATE } from './click-rate';
import {
  MAX_CLICK_GROUPS,
  NO_CLICK,
  stemSetClickOf,
  stemSetClickViolation,
} from './click-settings';
import { MAX_BEATS } from './preset-rules';
import { stemSets } from './schema';
import { createSongLibraryRepository } from './song-library-repository';
import type { NewStemBundle } from './stem-bundle-repository';
import { openTestDatabase } from './sqlite.test-helper';

const open: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of open.splice(0)) connection.close();
});

function setup() {
  const handle = openTestDatabase();
  open.push(handle);
  return { handle, library: createSongLibraryRepository(handle) };
}

const BUNDLE: NewStemBundle = {
  uuid: 'click-uuid',
  jobId: 'click-job',
  title: 'Seven',
  songTitle: null,
  artist: null,
  folder: 'stems/seven',
  sampleRate: 44100,
  channels: 2,
  stems: [],
  hasMix: false,
  bpm: null,
  key: null,
  scale: null,
  keyConfidence: null,
  loudnessLufs: null,
  tempoStability: null,
  sections: [],
  lyrics: null,
  beats: [],
  bars: [],
  tempo: null,
};

describe('a click grouping on save', () => {
  it('accepts no grouping, and one that fills the longest bar', () => {
    expect(stemSetClickViolation({ clickGrouping: [] })).toBeNull();
    expect(
      stemSetClickViolation({ clickGrouping: [MAX_BEATS / 2, MAX_BEATS / 2] }),
    ).toBeNull();
  });

  it('refuses more groups than the engine takes', () => {
    const groups = Array.from({ length: MAX_CLICK_GROUPS + 1 }, () => 1);
    expect(stemSetClickViolation({ clickGrouping: groups })).toMatchObject({
      field: 'clickGrouping',
    });
  });

  it('refuses a group under one beat', () => {
    expect(stemSetClickViolation({ clickGrouping: [3, 0, 2] })).toMatchObject({
      field: 'clickGrouping',
    });
  });

  it('refuses a fractional group', () => {
    expect(stemSetClickViolation({ clickGrouping: [2.5, 2] })).toMatchObject({
      field: 'clickGrouping',
    });
  });

  it('refuses groups summing past the longest bar', () => {
    expect(
      stemSetClickViolation({ clickGrouping: [MAX_BEATS, 1] }),
    ).toMatchObject({ field: 'clickGrouping' });
  });

  it('refuses a rate outside the named rates', () => {
    expect(
      stemSetClickViolation({ clickRate: 'triple' as typeof CLICK_RATE.half }),
    ).toMatchObject({ field: 'clickRate' });
  });
});

describe('a stored click', () => {
  it('reads no grouping and the single rate from a fresh row', () => {
    expect(
      stemSetClickOf({ clickGrouping: null, clickRate: 'single' }),
    ).toEqual(NO_CLICK);
  });

  it('reads an unreadable grouping or rate as the defaults', () => {
    expect(
      stemSetClickOf({ clickGrouping: '[3,0]', clickRate: 'warp' }),
    ).toEqual(NO_CLICK);
    expect(stemSetClickOf({ clickGrouping: '{', clickRate: 'half' })).toEqual({
      ...NO_CLICK,
      clickRate: CLICK_RATE.half,
    });
  });
});

describe('saving a stem song click', () => {
  it('reads back the grouping and rate it saved', async () => {
    const { library } = setup();
    const id = await library.insertStemBundle(BUNDLE);
    await library.saveStemSetClick(id, {
      clickGrouping: [3, 2, 2],
      clickRate: CLICK_RATE.half,
    });
    expect(await library.readStemSet(id)).toMatchObject({
      clickGrouping: [3, 2, 2],
      clickRate: CLICK_RATE.half,
    });
  });

  it('stores no grouping as null, leaving the rate alone', async () => {
    const { handle, library } = setup();
    const id = await library.insertStemBundle(BUNDLE);
    await library.saveStemSetClick(id, {
      clickGrouping: [2, 2],
      clickRate: CLICK_RATE.double,
    });
    await library.saveStemSetClick(id, { clickGrouping: [] });
    const [row] = await handle.db.select().from(stemSets);
    expect(row).toMatchObject({
      clickGrouping: null,
      clickRate: CLICK_RATE.double,
    });
  });

  it('writes nothing for a bad grouping', async () => {
    const { library } = setup();
    const id = await library.insertStemBundle(BUNDLE);
    await library.saveStemSetClick(id, { clickGrouping: [2, 2] });
    await expect(
      library.saveStemSetClick(id, { clickGrouping: [0] }),
    ).rejects.toThrow(RangeError);
    expect(await library.readStemSet(id)).toMatchObject({
      clickGrouping: [2, 2],
    });
  });
});
