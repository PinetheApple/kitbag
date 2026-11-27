import { describe, expect, it } from 'vitest';

import { toBlob } from '../library/presetMapping.ts';
import {
  BPM,
  fakePlayAlong,
  presetShelf,
  settle,
} from './store.test-helper.ts';

const MATCH = { kind: 'song', id: 3, bpm: 113 } as const;
const GRID = {
  beats: [8.9, 9.4, 9.95, 10.55, 11.2, 11.9, 12.65],
  downbeatIndices: [0, 4],
};
const BEATS_PER_BAR = 3;
const DENOMINATOR = 4;
const PHASE_NUDGE_MS = 37;
const PRESET_ROW = {
  name: 'Song',
  title: 'Song',
  artist: 'Band',
  bpm: BPM,
  beatsPerBar: BEATS_PER_BAR,
  denominator: DENOMINATOR,
  subdivision: 1,
  accents: toBlob([2, 0, 0]),
  sound: 0,
  librarySongId: MATCH.id,
  phaseNudge: PHASE_NUDGE_MS,
};

const CLEARED_RECALL = { savedPhaseMs: undefined, presetRecalled: false };

describe('accepting an offer whose song has a preset', () => {
  it('locks at the preset phase nudge and marks the preset recalled', async () => {
    const fake = fakePlayAlong({
      grid: GRID,
      shelf: presetShelf([PRESET_ROW]),
    });
    fake.store.getState().watchLibrary();
    fake.ladder.found(MATCH);
    await settle();
    fake.store.setState(CLEARED_RECALL);
    await fake.store.getState().acceptOffer();
    await settle();
    const state = fake.store.getState();
    expect(state.lock?.phaseOffsetMs).toBe(PHASE_NUDGE_MS);
    expect(state.savedPhaseMs).toBe(PHASE_NUDGE_MS);
    expect(state.presetRecalled).toBe(true);
  });
});
