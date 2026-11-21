import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@op-engineering/op-sqlite', () => ({}));

import { stemSets } from './schema';
import { createSongLibraryRepository } from './song-library-repository';
import type { NewStemBundle } from './stem-bundle-repository';
import {
  bundleTempoOf,
  bundleTempoViolation,
  canBuildTempoMode,
  storedTempoOf,
  type BundleTempo,
} from './stem-tempo';
import {
  TEMPO_MAX_BEATS_PER_BAR,
  TEMPO_MAX_BPM,
  TEMPO_MIN_BPM,
  TEMPO_MODE,
  TEMPO_SOURCE,
  type TempoMode,
} from './tempo-mode';
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

const FOLLOW: BundleTempo = {
  mode: TEMPO_MODE.follow,
  bpm: 127.3,
  anchor: 0.42,
  beatsPerBar: 4,
  source: TEMPO_SOURCE.detected,
};

const CONSTANT: BundleTempo = {
  ...FOLLOW,
  mode: TEMPO_MODE.constant,
  source: TEMPO_SOURCE.user,
};

const UNTIMED: BundleTempo = {
  ...FOLLOW,
  bpm: null,
  anchor: null,
};

const BPM_ONLY: BundleTempo = { ...FOLLOW, anchor: null };
const ANCHOR_ONLY: BundleTempo = { ...FOLLOW, bpm: null };

const BUNDLE: NewStemBundle = {
  uuid: 'tempo-uuid',
  jobId: 'tempo-job',
  title: 'Drift',
  songTitle: null,
  artist: null,
  folder: 'stems/drift',
  sampleRate: 44100,
  channels: 2,
  stems: [],
  hasMix: false,
  bpm: 127.3,
  key: null,
  scale: null,
  keyConfidence: null,
  loudnessLufs: null,
  tempoStability: null,
  sections: [],
  lyrics: null,
  beats: [0.42, 0.89],
  bars: [{ beat: 0, beatsPerBar: 4 }],
  tempo: FOLLOW,
};

const ROW = {
  tempoMode: FOLLOW.mode,
  tempoBpm: FOLLOW.bpm,
  tempoAnchor: FOLLOW.anchor,
  tempoBeatsPerBar: FOLLOW.beatsPerBar,
  tempoSource: FOLLOW.source,
  chosenTempoMode: null,
};

describe('a bundle tempo on save', () => {
  it('accepts either mode from either source', () => {
    expect(bundleTempoViolation(FOLLOW)).toBeNull();
    expect(bundleTempoViolation(CONSTANT)).toBeNull();
  });

  it('accepts a follow tempo StemDeck found no bpm or anchor for', () => {
    expect(bundleTempoViolation(UNTIMED)).toBeNull();
    expect(bundleTempoOf(UNTIMED)).toEqual(UNTIMED);
  });

  it('accepts a follow tempo with only a bpm or only an anchor', () => {
    expect(bundleTempoOf(BPM_ONLY)).toEqual(BPM_ONLY);
    expect(bundleTempoOf(ANCHOR_ONLY)).toEqual(ANCHOR_ONLY);
  });

  it("keeps StemDeck's whole range", () => {
    for (const patch of [
      { bpm: TEMPO_MIN_BPM, beatsPerBar: 1 },
      { bpm: TEMPO_MAX_BPM, beatsPerBar: TEMPO_MAX_BEATS_PER_BAR },
    ])
      expect(bundleTempoViolation({ ...CONSTANT, ...patch })).toBeNull();
  });

  it.each([
    ['bpm', { bpm: null }],
    ['anchor', { anchor: null }],
  ])('refuses a constant tempo without its %s', (field, patch) => {
    expect(bundleTempoViolation({ ...CONSTANT, ...patch })).toMatchObject({
      field,
    });
  });

  it.each([
    ['mode', { mode: 'steady' }],
    ['source', { source: 'guessed' }],
    ['bpm', { bpm: 0 }],
    ['bpm', { bpm: TEMPO_MIN_BPM - 0.1 }],
    ['bpm', { bpm: 500 }],
    ['beatsPerBar', { beatsPerBar: 33 }],
    ['bpm', { bpm: Number.NaN }],
    ['anchor', { anchor: -0.1 }],
    ['anchor', { anchor: Number.POSITIVE_INFINITY }],
    ['beatsPerBar', { beatsPerBar: 0 }],
    ['beatsPerBar', { beatsPerBar: 3.5 }],
  ])('refuses a bad %s', (field, patch) => {
    expect(bundleTempoViolation({ ...FOLLOW, ...patch })).toMatchObject({
      field,
    });
    expect(bundleTempoOf({ ...FOLLOW, ...patch })).toBeNull();
  });

  it('refuses to store a bad tempo, writing nothing', async () => {
    const { handle, library } = setup();
    const bad = { ...FOLLOW, mode: 'steady' } as unknown as BundleTempo;
    await expect(
      library.insertStemBundle({ ...BUNDLE, tempo: bad }),
    ).rejects.toThrow(RangeError);
    expect(await handle.db.select().from(stemSets)).toEqual([]);
  });
});

describe('which modes a bundle can build', () => {
  it('builds a follow bundle in either mode', () => {
    expect(canBuildTempoMode(FOLLOW, TEMPO_MODE.follow)).toBe(true);
    expect(canBuildTempoMode(FOLLOW, TEMPO_MODE.constant)).toBe(true);
  });

  it('builds a constant bundle only at its constant tempo', () => {
    expect(canBuildTempoMode(CONSTANT, TEMPO_MODE.constant)).toBe(true);
    expect(canBuildTempoMode(CONSTANT, TEMPO_MODE.follow)).toBe(false);
  });

  it('builds a follow bundle with no bpm or anchor only as it follows', () => {
    expect(canBuildTempoMode(UNTIMED, TEMPO_MODE.follow)).toBe(true);
    expect(canBuildTempoMode(UNTIMED, TEMPO_MODE.constant)).toBe(false);
  });

  it('builds no constant grid from a follow bundle missing its bpm or anchor', () => {
    expect(canBuildTempoMode(BPM_ONLY, TEMPO_MODE.constant)).toBe(false);
    expect(canBuildTempoMode(ANCHOR_ONLY, TEMPO_MODE.constant)).toBe(false);
  });

  it('builds no switch for a bundle without a tempo', () => {
    expect(canBuildTempoMode(null, TEMPO_MODE.constant)).toBe(false);
    expect(canBuildTempoMode(null, TEMPO_MODE.follow)).toBe(false);
  });
});

describe('a stored tempo', () => {
  it('reads a whole row back as the bundle tempo', () => {
    expect(storedTempoOf(ROW)).toEqual({
      tempo: FOLLOW,
      chosenTempoMode: null,
    });
  });

  it('reads a row with any unreadable tempo field as no tempo', () => {
    const constantRow = { ...ROW, tempoMode: TEMPO_MODE.constant };
    expect(storedTempoOf({ ...constantRow, tempoBpm: null }).tempo).toBeNull();
    expect(storedTempoOf({ ...ROW, tempoSource: 'x' }).tempo).toBeNull();
  });

  it('reads a chosen mode the bundle cannot build as the bundle mode', () => {
    const constantRow = { ...ROW, tempoMode: TEMPO_MODE.constant };
    expect(
      storedTempoOf({ ...constantRow, chosenTempoMode: TEMPO_MODE.follow })
        .chosenTempoMode,
    ).toBeNull();
    expect(
      storedTempoOf({ ...ROW, chosenTempoMode: 'steady' }).chosenTempoMode,
    ).toBeNull();
  });
});

describe('a stem song tempo in the library', () => {
  it('reads back the bundle tempo it imported, with no chosen mode', async () => {
    const { library } = setup();
    const id = await library.insertStemBundle(BUNDLE);
    expect(await library.readStemSet(id)).toMatchObject({
      tempo: FOLLOW,
      chosenTempoMode: null,
    });
  });

  it('reads back a follow tempo with no bpm or anchor', async () => {
    const { handle, library } = setup();
    const id = await library.insertStemBundle({ ...BUNDLE, tempo: UNTIMED });
    expect(await library.readStemSet(id)).toMatchObject({ tempo: UNTIMED });
    const [row] = await handle.db.select().from(stemSets);
    expect(row).toMatchObject({
      tempoMode: TEMPO_MODE.follow,
      tempoBpm: null,
      tempoAnchor: null,
    });
  });

  it('imports a bundle without a tempo as today', async () => {
    const { handle, library } = setup();
    const id = await library.insertStemBundle({ ...BUNDLE, tempo: null });
    expect(await library.readStemSet(id)).toMatchObject({
      tempo: null,
      chosenTempoMode: null,
    });
    const [row] = await handle.db.select().from(stemSets);
    expect(row).toMatchObject({ tempoMode: null, tempoBpm: null });
  });

  it('saves a chosen mode and clears it back to the bundle mode', async () => {
    const { library } = setup();
    const id = await library.insertStemBundle(BUNDLE);
    await library.saveStemSetChosenTempoMode(id, TEMPO_MODE.constant);
    expect(await library.readStemSet(id)).toMatchObject({
      chosenTempoMode: TEMPO_MODE.constant,
    });
    await library.saveStemSetChosenTempoMode(id, null);
    expect(await library.readStemSet(id)).toMatchObject({
      chosenTempoMode: null,
    });
  });

  it('refuses a mode the bundle cannot build, writing nothing', async () => {
    const { library } = setup();
    const id = await library.insertStemBundle({ ...BUNDLE, tempo: UNTIMED });
    await expect(
      library.saveStemSetChosenTempoMode(id, TEMPO_MODE.constant),
    ).rejects.toThrow(RangeError);
    expect(await library.readStemSet(id)).toMatchObject({
      chosenTempoMode: null,
    });
  });

  it('writes nothing for a mode outside the named modes', async () => {
    const { library } = setup();
    const id = await library.insertStemBundle(BUNDLE);
    await library.saveStemSetChosenTempoMode(id, TEMPO_MODE.constant);
    await expect(
      library.saveStemSetChosenTempoMode(id, 'steady' as TempoMode),
    ).rejects.toThrow(RangeError);
    expect(await library.readStemSet(id)).toMatchObject({
      chosenTempoMode: TEMPO_MODE.constant,
    });
  });
});

describe('a chosen tempo mode on Replace', () => {
  async function replacedChoice(chosen: TempoMode, next: BundleTempo | null) {
    const { handle, library } = setup();
    const old = await library.insertStemBundle(BUNDLE);
    await library.saveStemSetChosenTempoMode(old, chosen);
    const outcome = await library.replaceStemBundle(
      { ...BUNDLE, uuid: 'tempo-uuid-2', tempo: next },
      old,
    );
    const [row] = await handle.db
      .select({ chosen: stemSets.chosenTempoMode })
      .from(stemSets)
      .where(eq(stemSets.id, outcome.id));
    return row?.chosen;
  }

  it('keeps the choice when the new bundle can build it', async () => {
    expect(await replacedChoice(TEMPO_MODE.constant, FOLLOW)).toBe(
      TEMPO_MODE.constant,
    );
    expect(await replacedChoice(TEMPO_MODE.constant, CONSTANT)).toBe(
      TEMPO_MODE.constant,
    );
  });

  it('carries no choice the old bundle could not build', async () => {
    const { handle, library } = setup();
    const old = await library.insertStemBundle({ ...BUNDLE, tempo: UNTIMED });
    await handle.db
      .update(stemSets)
      .set({ chosenTempoMode: TEMPO_MODE.constant })
      .where(eq(stemSets.id, old));
    const outcome = await library.replaceStemBundle(
      { ...BUNDLE, uuid: 'tempo-uuid-3', tempo: FOLLOW },
      old,
    );
    const [row] = await handle.db
      .select({ chosen: stemSets.chosenTempoMode })
      .from(stemSets)
      .where(eq(stemSets.id, outcome.id));
    expect(row?.chosen).toBeNull();
  });

  it('falls back to the bundle mode when the new bundle cannot build it', async () => {
    expect(await replacedChoice(TEMPO_MODE.follow, CONSTANT)).toBeNull();
    expect(await replacedChoice(TEMPO_MODE.constant, null)).toBeNull();
    expect(await replacedChoice(TEMPO_MODE.constant, UNTIMED)).toBeNull();
  });
});
