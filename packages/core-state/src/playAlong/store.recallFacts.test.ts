import { MS_PER_SECOND, type SongPreset } from '@kitbag/core-db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { toBlob } from '../library/presetMapping.ts';
import {
  BPM,
  fakePlayAlong,
  locked,
  presetShelf,
  SESSION_ID,
  settle,
  snapshot,
} from './store.test-helper.ts';
import { SAVE_REFUSAL } from './trackPreset.ts';

const NUDGE_MS = 30;
const FRACTIONAL_NUDGE_MS = 12.6;
const SAVED_PHASE_MS = 40;
const SAVED_BEATS = 3;
const QUARTER = 4;
const LIBRARY_SONG_ID = 7;
const TRACK_SEC = (snapshot().durationMs ?? 0) / MS_PER_SECOND;
const OTHER_TRACK = { title: 'Other', artist: 'Someone' };
const MATCH = { kind: 'song', id: LIBRARY_SONG_ID, bpm: BPM } as const;

afterEach(() => {
  vi.useRealTimers();
});

const savedPreset = (overrides: Partial<SongPreset> = {}) => ({
  name: 'Song',
  title: 'Song',
  artist: 'Band',
  source: SESSION_ID,
  lengthSeconds: TRACK_SEC,
  bpm: null,
  beatsPerBar: SAVED_BEATS,
  denominator: QUARTER,
  subdivision: 1,
  accents: toBlob([2, 0, 0]),
  sound: 0,
  phaseNudge: NUDGE_MS,
  ...overrides,
});

function recalling(overrides: Partial<SongPreset> = {}) {
  const fake = fakePlayAlong({
    shelf: presetShelf([savedPreset(overrides)]),
  });
  fake.store.getState().watchLibrary();
  return fake;
}

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
    const fake = recalling();
    await settle();
    expect(fake.store.getState()).toMatchObject({
      savedPhaseMs: NUDGE_MS,
      presetRecalled: true,
    });
  });

  it('keeps a fractional saved phase as stored and locks at whole ms', async () => {
    const fake = recalling({ phaseNudge: FRACTIONAL_NUDGE_MS });
    await settle();
    expect(fake.store.getState().savedPhaseMs).toBe(FRACTIONAL_NUDGE_MS);
    locked(fake);
    expect(fake.store.getState().lock?.phaseOffsetMs).toBe(
      Math.round(FRACTIONAL_NUDGE_MS),
    );
  });

  it('names no phase when no preset matches', async () => {
    const fake = recalling(OTHER_TRACK);
    await settle();
    expect(fake.store.getState()).toMatchObject({
      savedPhaseMs: undefined,
      presetRecalled: false,
    });
  });

  it('names the phase just saved and does not call a later recall of it recalled', async () => {
    const fake = recalling();
    await settle();
    locked(fake);
    fake.store.getState().setPhaseOffset(SAVED_PHASE_MS);
    await fake.store.getState().saveForTrack();
    const beatsSent = fake.commands.setBeats.mock.calls.length;
    fake.ladder.found(MATCH);
    await settle();
    expect(fake.store.getState()).toMatchObject({
      savedPhaseMs: SAVED_PHASE_MS,
      presetRecalled: false,
    });
    expect(fake.commands.setBeats.mock.calls).toHaveLength(beatsSent);
  });

  it('calls a linked preset the library match finds while locked recalled', async () => {
    const fake = recalling({ source: null, librarySongId: LIBRARY_SONG_ID });
    await settle();
    locked(fake);
    expect(fake.store.getState().presetRecalled).toBe(false);
    fake.ladder.found(MATCH);
    await settle();
    expect(fake.store.getState()).toMatchObject({
      savedPhaseMs: NUDGE_MS,
      presetRecalled: true,
    });
  });

  it('still calls it recalled when a save fails', async () => {
    const fake = recalling();
    await settle();
    locked(fake);
    fake.shelf.repository.update.mockRejectedValueOnce(new Error('disk'));
    expect(await fake.store.getState().saveForTrack()).toEqual({
      saved: false,
      reason: SAVE_REFUSAL.writeFailed,
    });
    expect(fake.store.getState().presetRecalled).toBe(true);
  });

  it('stops calling it recalled once it unlocks', async () => {
    const fake = recalling();
    await settle();
    locked(fake);
    fake.store.getState().unlock();
    expect(fake.store.getState()).toMatchObject({
      savedPhaseMs: NUDGE_MS,
      presetRecalled: false,
    });
  });

  it('forgets both when the track changes', async () => {
    const fake = recalling();
    await settle();
    fake.report([snapshot(OTHER_TRACK)]);
    await settle();
    expect(fake.store.getState()).toMatchObject({
      savedPhaseMs: undefined,
      presetRecalled: false,
    });
  });
});
