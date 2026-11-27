import { MS_PER_SECOND } from '@kitbag/core-db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { toBlob } from '../library/presetMapping.ts';
import { initialConfig } from '../metronome/store.ts';
import { phaseLimitMs } from './phase.ts';
import {
  BPM,
  fakePlayAlong,
  locked,
  OTHER_ID,
  presetShelf,
  SESSION_ID,
  settle,
  snapshot,
} from './store.test-helper.ts';
import { SAVE_REFUSAL } from './trackPreset.ts';

const SAVED_BEATS = 3;
const DEFAULT_BEATS = initialConfig().beatsPerBar;
const QUARTER = 4;
const TRIPLET = 3;
const DUPLET = 2;
const WOOD = 2;
const CLAVE = 3;
const NUDGE_MS = 30;
const FRACTIONAL_NUDGE_MS = 12.6;
const ROUNDED_NUDGE_MS = 13;
const FAR_NUDGE_MS = 1000;
const LIBRARY_SONG_ID = 7;
const OTHER_SONG_ID = 99;
const PRESET_BPM = 200;
const METRONOME_BPM = 140;
const UNIT_SPEED = 1;
const TRACK_MS = 200_000;
const TRACK_SEC = TRACK_MS / MS_PER_SECOND;
const ALBUM_MS = 240_000;
const SAVED_ACCENTS = [2, 0, 0];
const OTHER_TRACK = { title: 'Other', artist: 'Someone' };
const OTHER_APP = 'other.app';
const MATCH = { kind: 'song', id: LIBRARY_SONG_ID, bpm: BPM } as const;
const GRID = { beats: [9.5, 10, 10.5, 11, 11.5], downbeatIndices: [0, 4] };

afterEach(() => {
  vi.useRealTimers();
});

const savedPreset = (overrides = {}) => ({
  name: 'Song',
  title: 'Song',
  artist: 'Band',
  source: SESSION_ID,
  lengthSeconds: TRACK_SEC,
  bpm: PRESET_BPM,
  beatsPerBar: SAVED_BEATS,
  denominator: QUARTER,
  subdivision: TRIPLET,
  accents: toBlob(SAVED_ACCENTS),
  perAccentSounds: toBlob([WOOD, CLAVE]),
  sound: WOOD,
  phaseNudge: NUDGE_MS,
  ...overrides,
});

function watched(fake: ReturnType<typeof fakePlayAlong>) {
  fake.store.getState().watchLibrary();
  return fake;
}

describe('save for this song', () => {
  it('refuses while unlocked and writes nothing', async () => {
    const fake = fakePlayAlong();
    expect(await fake.store.getState().saveForTrack()).toEqual({
      saved: false,
      reason: SAVE_REFUSAL.notLocked,
    });
    expect(fake.shelf.rows()).toEqual([]);
  });

  it('stores the click settings, phase and track identity, without a tempo', async () => {
    const fake = locked();
    fake.store.getState().setSubdivision(TRIPLET);
    fake.store.getState().nudgePhase(1);
    const { phaseOffsetMs } = fake.store.getState().lock ?? {};
    expect(await fake.store.getState().saveForTrack()).toEqual({ saved: true });
    expect(fake.shelf.rows()).toEqual([
      expect.objectContaining({
        title: 'Song',
        artist: 'Band',
        source: SESSION_ID,
        lengthSeconds: TRACK_SEC,
        bpm: null,
        subdivision: TRIPLET,
        phaseNudge: phaseOffsetMs,
        librarySongId: null,
      }),
    ]);
    expect(fake.store.getState().hasSavedPreset).toBe(true);
  });

  it('updates the same preset when saved again', async () => {
    const fake = locked();
    await fake.store.getState().saveForTrack();
    fake.store.getState().setSubdivision(TRIPLET);
    await fake.store.getState().saveForTrack();
    expect(fake.shelf.rows()).toHaveLength(1);
    expect(fake.shelf.rows()[0]?.subdivision).toBe(TRIPLET);
  });

  it('keeps one preset when saved twice at once', async () => {
    const fake = locked();
    await Promise.all([
      fake.store.getState().saveForTrack(),
      fake.store.getState().saveForTrack(),
    ]);
    expect(fake.shelf.rows()).toHaveLength(1);
  });

  it('links the preset to the library song the track matches', async () => {
    const fake = watched(fakePlayAlong());
    fake.ladder.found(MATCH);
    locked(fake);
    await fake.store.getState().saveForTrack();
    expect(fake.shelf.rows()).toEqual([
      expect.objectContaining({ librarySongId: LIBRARY_SONG_ID, bpm: null }),
    ]);
  });

  it('links an unlinked preset for the track once its library song is known', async () => {
    const fake = watched(
      fakePlayAlong({
        shelf: presetShelf([savedPreset({ librarySongId: null })]),
      }),
    );
    fake.ladder.found(MATCH);
    locked(fake);
    await fake.store.getState().saveForTrack();
    expect(fake.shelf.rows()).toEqual([
      expect.objectContaining({ librarySongId: LIBRARY_SONG_ID }),
    ]);
  });

  it('never takes over a preset linked to another library song', async () => {
    const fake = watched(
      fakePlayAlong({
        shelf: presetShelf([savedPreset({ librarySongId: OTHER_SONG_ID })]),
      }),
    );
    fake.ladder.found(MATCH);
    locked(fake);
    await fake.store.getState().saveForTrack();
    expect(fake.shelf.rows().map((row) => row.librarySongId)).toEqual([
      OTHER_SONG_ID,
      LIBRARY_SONG_ID,
    ]);
  });

  it('keeps the tempo and ramp of a metronome preset it updates', async () => {
    const fake = watched(
      fakePlayAlong({
        shelf: presetShelf([
          savedPreset({
            librarySongId: LIBRARY_SONG_ID,
            bpm: METRONOME_BPM,
            rampEnabled: true,
            phaseNudge: 0,
          }),
        ]),
      }),
    );
    fake.ladder.found(MATCH);
    await settle();
    locked(fake);
    fake.store.getState().setPhaseOffset(NUDGE_MS);
    await fake.store.getState().saveForTrack();
    expect(fake.shelf.rows()).toEqual([
      expect.objectContaining({
        bpm: METRONOME_BPM,
        rampEnabled: true,
        phaseNudge: NUDGE_MS,
      }),
    ]);
  });

  it('keeps the same song from another app as its own preset', async () => {
    const fake = locked(
      fakePlayAlong({
        sessions: [snapshot({ packageName: OTHER_APP })],
        shelf: presetShelf([savedPreset()]),
      }),
    );
    await fake.store.getState().saveForTrack();
    expect(fake.shelf.rows().map((row) => row.source)).toEqual([
      SESSION_ID,
      OTHER_APP,
    ]);
  });

  it('keeps an album cut apart from the radio edit', async () => {
    const fake = locked(
      fakePlayAlong({
        sessions: [snapshot({ durationMs: ALBUM_MS })],
        shelf: presetShelf([savedPreset()]),
      }),
    );
    await fake.store.getState().saveForTrack();
    expect(fake.shelf.rows()).toHaveLength(2);
  });

  it('refuses a track with no title', async () => {
    const fake = locked(
      fakePlayAlong({ sessions: [snapshot({ title: ' ' })] }),
    );
    expect(await fake.store.getState().saveForTrack()).toEqual({
      saved: false,
      reason: SAVE_REFUSAL.noTrackIdentity,
    });
    expect(fake.shelf.rows()).toEqual([]);
  });

  it('saves for the locked track, not the one chosen since', async () => {
    const fake = locked(
      fakePlayAlong({
        sessions: [
          snapshot(),
          snapshot({
            sessionId: OTHER_ID,
            packageName: OTHER_APP,
            ...OTHER_TRACK,
          }),
        ],
      }),
    );
    fake.media.setState({ chosenId: OTHER_ID });
    await fake.store.getState().saveForTrack();
    expect(fake.shelf.rows()).toEqual([
      expect.objectContaining({ title: 'Song', source: SESSION_ID }),
    ]);
  });

  it('says the write failed', async () => {
    const fake = locked();
    fake.shelf.repository.create.mockRejectedValueOnce(new Error('disk'));
    expect(await fake.store.getState().saveForTrack()).toEqual({
      saved: false,
      reason: SAVE_REFUSAL.writeFailed,
    });
    expect(fake.store.getState().hasSavedPreset).toBe(false);
  });
});

describe('recall for the chosen track', () => {
  it('puts a saved pattern into Play along and keeps the found tempo', async () => {
    const fake = watched(
      fakePlayAlong({ shelf: presetShelf([savedPreset()]) }),
    );
    fake.ladder.tempo(BPM);
    await settle();
    const { pattern, bpm, hasSavedPreset } = fake.store.getState();
    expect(pattern).toMatchObject({
      beatsPerBar: SAVED_BEATS,
      subdivision: TRIPLET,
      accents: SAVED_ACCENTS,
      sounds: { normal: WOOD, accent: CLAVE },
    });
    expect(bpm).toBe(BPM);
    expect(hasSavedPreset).toBe(true);
  });

  it('applies the saved phase on the next lock', async () => {
    const fake = watched(
      fakePlayAlong({ shelf: presetShelf([savedPreset()]) }),
    );
    await settle();
    locked(fake);
    expect(fake.store.getState().lock?.phaseOffsetMs).toBe(NUDGE_MS);
  });

  it('applies the saved phase to a library grid lock', async () => {
    const fake = watched(
      fakePlayAlong({ grid: GRID, shelf: presetShelf([savedPreset()]) }),
    );
    fake.ladder.found(MATCH);
    await settle();
    await fake.store.getState().acceptOffer();
    await settle();
    expect(fake.store.getState().lock?.phaseOffsetMs).toBe(NUDGE_MS);
  });

  it('clamps a saved phase to half a beat at the lock tempo', async () => {
    const fake = watched(
      fakePlayAlong({
        shelf: presetShelf([savedPreset({ phaseNudge: FAR_NUDGE_MS })]),
      }),
    );
    await settle();
    locked(fake);
    expect(fake.store.getState().lock?.phaseOffsetMs).toBe(
      phaseLimitMs(BPM, QUARTER, UNIT_SPEED),
    );
  });

  it('recalls when the track changes to a saved one', async () => {
    const fake = watched(
      fakePlayAlong({
        sessions: [snapshot(OTHER_TRACK)],
        shelf: presetShelf([savedPreset()]),
      }),
    );
    await settle();
    expect(fake.store.getState().pattern.beatsPerBar).toBe(DEFAULT_BEATS);
    fake.report([snapshot()]);
    await settle();
    expect(fake.store.getState().pattern.beatsPerBar).toBe(SAVED_BEATS);
  });

  it('changes nothing when no preset matches', async () => {
    const fake = fakePlayAlong({
      shelf: presetShelf([savedPreset(OTHER_TRACK)]),
    });
    const before = fake.store.getState().pattern;
    watched(fake);
    await settle();
    expect(fake.store.getState().pattern).toBe(before);
    expect(fake.store.getState().hasSavedPreset).toBe(false);
  });

  it('recalls nothing saved from another app', async () => {
    const fake = watched(
      fakePlayAlong({
        sessions: [snapshot({ packageName: OTHER_APP })],
        shelf: presetShelf([savedPreset()]),
      }),
    );
    await settle();
    expect(fake.store.getState().pattern.beatsPerBar).toBe(DEFAULT_BEATS);
  });

  it('recalls nothing saved for another cut of the song', async () => {
    const fake = watched(
      fakePlayAlong({
        sessions: [snapshot({ durationMs: ALBUM_MS })],
        shelf: presetShelf([savedPreset()]),
      }),
    );
    await settle();
    expect(fake.store.getState().hasSavedPreset).toBe(false);
  });

  it('recalls nothing for a track with no title', async () => {
    const fake = watched(
      fakePlayAlong({
        sessions: [snapshot({ title: null })],
        shelf: presetShelf([savedPreset({ title: '' })]),
      }),
    );
    await settle();
    expect(fake.shelf.repository.list).not.toHaveBeenCalled();
  });

  it('keeps an edit made after recall when the library match finds the same preset', async () => {
    const fake = watched(
      fakePlayAlong({ shelf: presetShelf([savedPreset()]) }),
    );
    await settle();
    fake.store.getState().setSubdivision(DUPLET);
    fake.ladder.found(MATCH);
    await settle();
    expect(fake.store.getState().pattern.subdivision).toBe(DUPLET);
  });

  it('applies the linked preset the library match finds', async () => {
    const fake = watched(
      fakePlayAlong({
        shelf: presetShelf([
          savedPreset(),
          savedPreset({ librarySongId: LIBRARY_SONG_ID, beatsPerBar: DUPLET }),
        ]),
      }),
    );
    await settle();
    fake.ladder.found(MATCH);
    await settle();
    expect(fake.store.getState().pattern.beatsPerBar).toBe(DUPLET);
  });
});

describe('what Play along says about a saved preset', () => {
  it('says nothing and reads nothing before it watches', () => {
    const fake = fakePlayAlong({ shelf: presetShelf([savedPreset()]) });
    expect(fake.store.getState()).toMatchObject({
      savedPhaseMs: undefined,
      presetRecalled: false,
    });
    expect(fake.shelf.repository.list).not.toHaveBeenCalled();
  });

  it('names a recalled preset and its phase', async () => {
    const fake = watched(
      fakePlayAlong({ shelf: presetShelf([savedPreset()]) }),
    );
    await settle();
    expect(fake.store.getState()).toMatchObject({
      savedPhaseMs: NUDGE_MS,
      presetRecalled: true,
    });
  });

  it('gives a saved phase in whole ms', async () => {
    const fake = watched(
      fakePlayAlong({
        shelf: presetShelf([savedPreset({ phaseNudge: FRACTIONAL_NUDGE_MS })]),
      }),
    );
    await settle();
    expect(fake.store.getState().savedPhaseMs).toBe(ROUNDED_NUDGE_MS);
  });

  it('names no phase when no preset matches', async () => {
    const fake = watched(
      fakePlayAlong({ shelf: presetShelf([savedPreset(OTHER_TRACK)]) }),
    );
    await settle();
    expect(fake.store.getState()).toMatchObject({
      savedPhaseMs: undefined,
      presetRecalled: false,
    });
  });

  it('names the phase just saved without calling it recalled', async () => {
    const fake = watched(
      fakePlayAlong({ shelf: presetShelf([savedPreset()]) }),
    );
    await settle();
    locked(fake);
    fake.store.getState().nudgePhase(1);
    const { phaseOffsetMs } = fake.store.getState().lock ?? {};
    await fake.store.getState().saveForTrack();
    expect(fake.store.getState()).toMatchObject({
      savedPhaseMs: phaseOffsetMs,
      presetRecalled: false,
    });
    fake.store.getState().unlock();
    await settle();
    expect(fake.store.getState().presetRecalled).toBe(false);
  });

  it('stops calling it recalled once it unlocks', async () => {
    const fake = watched(
      fakePlayAlong({ shelf: presetShelf([savedPreset()]) }),
    );
    await settle();
    locked(fake);
    fake.store.getState().unlock();
    expect(fake.store.getState()).toMatchObject({
      savedPhaseMs: NUDGE_MS,
      presetRecalled: false,
    });
  });

  it('forgets both when the track changes', async () => {
    const fake = watched(
      fakePlayAlong({ shelf: presetShelf([savedPreset()]) }),
    );
    await settle();
    fake.report([snapshot(OTHER_TRACK)]);
    await settle();
    expect(fake.store.getState()).toMatchObject({
      savedPhaseMs: undefined,
      presetRecalled: false,
    });
  });
});
