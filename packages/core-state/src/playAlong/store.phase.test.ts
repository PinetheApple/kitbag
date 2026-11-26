import { MS_PER_SECOND } from '@kitbag/core-db';
import { KB_RESULT } from '@kitbag/core-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_PHASE_STEP_MS,
  PHASE_STEPS_MS,
  phaseLimitMs,
} from './phase.ts';
import { SECONDS_PER_MINUTE } from '../text.ts';
import { UNLOCK_REASON } from './lockOutcome.ts';
import { REANCHOR_INTERVAL_MS } from './store.ts';
import {
  BPM,
  fakePlayAlong,
  LATENCY_MS,
  locked,
  snapshot,
} from './store.test-helper.ts';

const MATCH = { kind: 'song', id: 3, bpm: 113 } as const;
const GRID = {
  beats: [8.9, 9.4, 9.95, 10.55, 11.2, 11.9, 12.65, 13.4, 14.1],
  downbeatIndices: [0, 4, 8],
};
const SHIFTED_INDICES = [1, 5];
const THREE_BEAT_GRID = {
  beats: [8.9, 9.4, 9.95, 10.55, 11.2, 11.9, 12.65, 13.4, 14.1, 14.8],
  downbeatIndices: [0, 3, 6, 9],
};
const THREE_BEAT_BACK_ONE = [2, 5, 8];
const NO_DOWNBEAT_GRID = { beats: GRID.beats, downbeatIndices: [] };
const [FINE_MS, , COARSE_MS] = PHASE_STEPS_MS;
const FAR_MS = 10_000;
const DOUBLE_BPM = BPM * 2;
const HALF_BPM = BPM / 2;
const BEATS = 4;
const QUARTER = 4;
const EIGHTH = 8;
const UNIT_SPEED = 1;
const FAST = 1.5;
const FASTER = 2;
const BEAT_SEC = SECONDS_PER_MINUTE / BPM;
const BAR_SEC = BEAT_SEC * BEATS;
const HALF_BEAT_MS_AT_BPM = (BEAT_SEC * MS_PER_SECOND) / 2;
const PRECISION = 9;

afterEach(() => {
  vi.useRealTimers();
});

async function settle() {
  for (let turn = 0; turn < 5; turn++) await Promise.resolve();
}

async function gridLocked(
  options: Parameters<typeof fakePlayAlong>[0] = { grid: GRID },
) {
  const fake = fakePlayAlong(options);
  fake.store.getState().watchLibrary();
  fake.ladder.found(MATCH);
  await fake.store.getState().acceptOffer();
  await settle();
  return fake;
}

const downbeatCalls = (fake: ReturnType<typeof fakePlayAlong>) =>
  fake.commands.metronomeSetGridDownbeats.mock.calls.map(([indices]) => [
    ...indices,
  ]);

const lastSongSec = (calls: readonly (readonly unknown[])[]) =>
  Number(calls.at(-1)?.[0]);

const barModulo = (sec: number) => ((sec % BAR_SEC) + BAR_SEC) % BAR_SEC;

describe('phase limit', () => {
  it('is half a beat at the tempo and meter', () => {
    expect(phaseLimitMs(BPM, QUARTER, UNIT_SPEED)).toBe(HALF_BEAT_MS_AT_BPM);
    expect(phaseLimitMs(HALF_BPM, EIGHTH, UNIT_SPEED)).toBe(
      HALF_BEAT_MS_AT_BPM,
    );
  });

  it('is half a beat at the tempo the player is heard at', () => {
    expect(phaseLimitMs(BPM, QUARTER, FAST)).toBeCloseTo(
      HALF_BEAT_MS_AT_BPM / FAST,
      PRECISION,
    );
  });
});

describe('phase while locked', () => {
  it('starts every lock at the tapped phase and downbeat', () => {
    const fake = locked();
    const { lock, phaseStepMs, latencyOffsetMs } = fake.store.getState();
    expect(lock?.phaseOffsetMs).toBe(0);
    expect(lock?.downbeatShift).toBe(0);
    expect(phaseStepMs).toBe(DEFAULT_PHASE_STEP_MS);
    expect(latencyOffsetMs).toBe(LATENCY_MS);
  });

  it('moves the click earlier by the nudge, live', () => {
    const fake = locked();
    const before = lastSongSec(fake.anchors());
    fake.store.getState().nudgePhase(1);
    expect(fake.store.getState().lock?.phaseOffsetMs).toBe(
      DEFAULT_PHASE_STEP_MS,
    );
    expect(lastSongSec(fake.anchors())).toBeCloseTo(
      before + DEFAULT_PHASE_STEP_MS / MS_PER_SECOND,
      PRECISION,
    );
  });

  it('nudges by the chosen step and keeps the step across locks', () => {
    const fake = locked();
    fake.store.getState().setPhaseStep(COARSE_MS);
    fake.store.getState().nudgePhase(-1);
    expect(fake.store.getState().lock?.phaseOffsetMs).toBe(-COARSE_MS);
    fake.store.getState().unlock();
    fake.store.getState().tap(Date.now());
    expect(fake.store.getState().phaseStepMs).toBe(COARSE_MS);
    expect(fake.store.getState().lock?.phaseOffsetMs).toBe(0);
  });

  it('clamps a set offset to half a beat either way', () => {
    const fake = locked();
    fake.store.getState().setPhaseOffset(FAR_MS);
    expect(fake.store.getState().lock?.phaseOffsetMs).toBe(HALF_BEAT_MS_AT_BPM);
    fake.store.getState().setPhaseOffset(-FAR_MS);
    expect(fake.store.getState().lock?.phaseOffsetMs).toBe(
      -HALF_BEAT_MS_AT_BPM,
    );
  });

  it('clamps to half a beat at the heard tempo when the song plays fast', () => {
    const fake = locked(
      fakePlayAlong({ sessions: [snapshot({ speed: FAST })] }),
    );
    fake.store.getState().setPhaseOffset(FAR_MS);
    expect(fake.store.getState().lock?.phaseOffsetMs).toBeCloseTo(
      HALF_BEAT_MS_AT_BPM / FAST,
      PRECISION,
    );
  });

  it('narrows the offset when the player speeds up', () => {
    const fake = locked();
    fake.store.getState().setPhaseOffset(FAR_MS);
    fake.report([snapshot({ speed: FASTER })]);
    expect(fake.store.getState().lock?.phaseOffsetMs).toBe(
      HALF_BEAT_MS_AT_BPM / FASTER,
    );
  });

  it('narrows the offset when the tempo rises', () => {
    const fake = locked();
    fake.store.getState().setPhaseOffset(FAR_MS);
    fake.store.getState().setBpm(DOUBLE_BPM);
    expect(fake.store.getState().lock?.phaseOffsetMs).toBe(
      HALF_BEAT_MS_AT_BPM / 2,
    );
  });

  it('ignores phase edits with no lock, but keeps the step', () => {
    const fake = fakePlayAlong();
    fake.store.getState().nudgePhase(1);
    fake.store.getState().setPhaseOffset(FINE_MS);
    fake.store.getState().shiftDownbeat(1);
    fake.store.getState().resetPhase();
    fake.store.getState().setPhaseStep(FINE_MS);
    expect(fake.calls).toEqual([]);
    expect(fake.store.getState().phaseStepMs).toBe(FINE_MS);
  });

  it('shifts the downbeat a beat later for a constant tempo', () => {
    const fake = locked();
    const before = lastSongSec(fake.anchors());
    fake.store.getState().shiftDownbeat(1);
    expect(fake.store.getState().lock?.downbeatShift).toBe(1);
    expect(barModulo(lastSongSec(fake.anchors()) - before)).toBeCloseTo(
      BAR_SEC - BEAT_SEC,
      PRECISION,
    );
  });

  it('wraps a shift back past beat 1 to the last beat of the bar', () => {
    const fake = locked();
    fake.store.getState().shiftDownbeat(-1);
    expect(fake.store.getState().lock?.downbeatShift).toBe(BEATS - 1);
  });

  it('resets phase and downbeat to the tapped lock', () => {
    const fake = locked();
    const tapped = lastSongSec(fake.anchors());
    fake.store.getState().nudgePhase(1);
    fake.store.getState().shiftDownbeat(1);
    fake.store.getState().resetPhase();
    expect(fake.store.getState().lock).toMatchObject({
      phaseOffsetMs: 0,
      downbeatShift: 0,
    });
    expect(lastSongSec(fake.anchors())).toBeCloseTo(tapped, PRECISION);
  });
});

describe('phase on a library grid lock', () => {
  it('moves the grid anchor without sending the grid again', async () => {
    const fake = await gridLocked();
    const before = lastSongSec(fake.gridAnchors());
    fake.store.getState().nudgePhase(1);
    expect(fake.grids()).toHaveLength(1);
    expect(lastSongSec(fake.gridAnchors())).toBeCloseTo(
      before + DEFAULT_PHASE_STEP_MS / MS_PER_SECOND,
      PRECISION,
    );
  });

  it('moves only the downbeats a beat and back, never the grid', async () => {
    const fake = await gridLocked();
    fake.store.getState().shiftDownbeat(1);
    await settle();
    fake.store.getState().resetPhase();
    await settle();
    expect(downbeatCalls(fake)).toEqual([
      SHIFTED_INDICES,
      GRID.downbeatIndices,
    ]);
    expect(fake.grids()).toHaveLength(1);
    expect(fake.store.getState().lock?.grid).toBe(GRID);
  });

  it('wraps a grid shift by the grid own bar, not the pattern meter', async () => {
    const fake = await gridLocked({ grid: THREE_BEAT_GRID });
    fake.store.getState().shiftDownbeat(-1);
    await settle();
    expect(fake.store.getState().pattern.beatsPerBar).toBe(BEATS);
    expect(downbeatCalls(fake)).toEqual([THREE_BEAT_BACK_ONE]);
  });

  it('cannot shift a grid that has no downbeats', async () => {
    const fake = await gridLocked({ grid: NO_DOWNBEAT_GRID });
    expect(fake.store.getState().lock?.downbeatShiftAvailable).toBe(false);
    fake.store.getState().shiftDownbeat(1);
    await settle();
    expect(fake.store.getState().lock?.downbeatShift).toBe(0);
    expect(downbeatCalls(fake)).toEqual([]);
  });

  it('sends a shift the engine refused again on the next anchor', async () => {
    const results = [KB_RESULT.KB_ERROR_INVALID_ARGUMENT, KB_RESULT.KB_OK];
    const fake = await gridLocked({
      grid: GRID,
      downbeatsResult: () => results.shift() ?? KB_RESULT.KB_OK,
    });
    fake.store.getState().shiftDownbeat(1);
    await settle();
    vi.advanceTimersByTime(REANCHOR_INTERVAL_MS);
    await settle();
    vi.advanceTimersByTime(REANCHOR_INTERVAL_MS);
    await settle();
    expect(downbeatCalls(fake)).toEqual([SHIFTED_INDICES, SHIFTED_INDICES]);
  });
});

describe('why the lock ended', () => {
  it('says a track change ended it, until the next lock', () => {
    const fake = locked();
    fake.report([snapshot({ title: 'Next song' })]);
    expect(fake.store.getState().lock).toBeUndefined();
    expect(fake.store.getState().unlockReason).toBe(UNLOCK_REASON.trackChanged);
    fake.store.getState().setBpm(BPM);
    fake.store.getState().tap(Date.now());
    expect(fake.store.getState().unlockReason).toBeUndefined();
  });

  it('gives no reason when the user unlocks', () => {
    const fake = locked();
    fake.store.getState().unlock();
    expect(fake.store.getState().unlockReason).toBeUndefined();
  });
});
