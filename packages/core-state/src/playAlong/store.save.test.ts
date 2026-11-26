import { afterEach, describe, expect, it, vi } from 'vitest';

import { toBlob } from '../library/presetMapping.ts';
import {
  BPM,
  fakePlayAlong,
  locked,
  presetShelf,
  SESSION_ID,
  snapshot,
} from './store.test-helper.ts';
import { SAVE_REFUSAL } from './trackPreset.ts';

const THREE = 3;
const QUARTER = 4;
const TRIPLET = 3;
const WOOD = 2;
const CLAVE = 3;
const NUDGE_MS = 30;
const LIBRARY_SONG_ID = 7;
const PRESET_BPM = 200;
const SAVED_ACCENTS = [2, 0, 0];
const OTHER_TRACK = { title: 'Other', artist: 'Someone' };
const MATCH = { kind: 'song', id: LIBRARY_SONG_ID, bpm: BPM } as const;

afterEach(() => {
  vi.useRealTimers();
});

async function settle() {
  for (let turn = 0; turn < 5; turn++) await Promise.resolve();
}

const savedPreset = (overrides = {}) => ({
  name: 'Song',
  title: 'Song',
  artist: 'Band',
  bpm: PRESET_BPM,
  beatsPerBar: THREE,
  denominator: QUARTER,
  subdivision: TRIPLET,
  accents: toBlob(SAVED_ACCENTS),
  perAccentSounds: toBlob([WOOD, CLAVE]),
  sound: WOOD,
  phaseNudge: NUDGE_MS,
  ...overrides,
});

describe('save for this song', () => {
  it('refuses while unlocked and writes nothing', async () => {
    const fake = fakePlayAlong();
    expect(await fake.store.getState().saveForTrack()).toEqual({
      saved: false,
      reason: SAVE_REFUSAL.notLocked,
    });
    expect(fake.shelf.rows()).toEqual([]);
  });

  it('stores the click settings and phase for the track, without a tempo', async () => {
    const fake = locked();
    fake.store.getState().setSubdivision(TRIPLET);
    fake.store.getState().nudgePhase(1);
    const { phaseOffsetMs } = fake.store.getState().lock ?? {};
    expect(await fake.store.getState().saveForTrack()).toEqual({ saved: true });
    expect(fake.shelf.rows()).toEqual([
      expect.objectContaining({
        title: 'Song',
        artist: 'Band',
        bpm: null,
        subdivision: TRIPLET,
        phaseNudge: phaseOffsetMs,
        librarySongId: null,
      }),
    ]);
    expect(fake.store.getState().savedForTrack).toBe(true);
  });

  it('updates the same preset when saved again', async () => {
    const fake = locked();
    await fake.store.getState().saveForTrack();
    fake.store.getState().setSubdivision(TRIPLET);
    await fake.store.getState().saveForTrack();
    expect(fake.shelf.rows()).toHaveLength(1);
    expect(fake.shelf.rows()[0]?.subdivision).toBe(TRIPLET);
  });

  it('links the preset to the library song the track matches', async () => {
    const fake = fakePlayAlong();
    fake.store.getState().watchLibrary();
    fake.ladder.found(MATCH);
    locked(fake);
    await fake.store.getState().saveForTrack();
    expect(fake.shelf.repository.saveForLibrarySong).toHaveBeenCalledWith(
      LIBRARY_SONG_ID,
      expect.objectContaining({ bpm: null }),
    );
  });

  it('says the write failed', async () => {
    const fake = locked();
    fake.shelf.repository.create.mockRejectedValueOnce(new Error('disk'));
    expect(await fake.store.getState().saveForTrack()).toEqual({
      saved: false,
      reason: SAVE_REFUSAL.writeFailed,
    });
    expect(fake.store.getState().savedForTrack).toBe(false);
  });
});

describe('recall for the chosen track', () => {
  it('puts a saved pattern into Play along and keeps the found tempo', async () => {
    const fake = fakePlayAlong({ shelf: presetShelf([savedPreset()]) });
    fake.store.getState().watchLibrary();
    fake.ladder.tempo(BPM);
    await settle();
    const { pattern, bpm, savedForTrack } = fake.store.getState();
    expect(pattern).toMatchObject({
      beatsPerBar: THREE,
      subdivision: TRIPLET,
      accents: SAVED_ACCENTS,
      sounds: { normal: WOOD, accent: CLAVE },
    });
    expect(bpm).toBe(BPM);
    expect(savedForTrack).toBe(true);
  });

  it('applies the saved phase on the next lock', async () => {
    const fake = fakePlayAlong({ shelf: presetShelf([savedPreset()]) });
    fake.store.getState().watchLibrary();
    await settle();
    locked(fake);
    expect(fake.store.getState().lock?.phaseOffsetMs).toBe(NUDGE_MS);
  });

  it('recalls when the track changes to a saved one', async () => {
    const fake = fakePlayAlong({
      sessions: [snapshot(OTHER_TRACK)],
      shelf: presetShelf([savedPreset()]),
    });
    fake.store.getState().watchLibrary();
    await settle();
    expect(fake.store.getState().pattern.beatsPerBar).toBe(QUARTER);
    fake.report([snapshot({ sessionId: SESSION_ID })]);
    await settle();
    expect(fake.store.getState().pattern.beatsPerBar).toBe(THREE);
  });

  it('changes nothing when no preset matches', async () => {
    const fake = fakePlayAlong({
      shelf: presetShelf([savedPreset(OTHER_TRACK)]),
    });
    const before = fake.store.getState().pattern;
    fake.store.getState().watchLibrary();
    await settle();
    expect(fake.store.getState().pattern).toBe(before);
    expect(fake.store.getState().savedForTrack).toBe(false);
    expect(fake.store.getState().bpm).not.toBe(PRESET_BPM);
  });
});
