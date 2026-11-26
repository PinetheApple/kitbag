import { MS_PER_SECOND } from '@kitbag/core-db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LOCK_REFUSAL } from './store.ts';
import {
  BPM,
  FRAMES_PER_MS,
  fakePlayAlong,
  OTHER_ID,
  PLAY_ALONG,
  SESSION_ID,
  snapshot,
  START_MS,
} from './store.test-helper.ts';

const TAP_AFTER_MS = 300;
const TAP_SONG_SEC = 10.3;
const LATE_MS = 40;
const FOUR_FOUR_BARS_BACK = 6;
const FOUR_FOUR_BAR_SEC = 2;

afterEach(() => {
  vi.useRealTimers();
});

function tapped(fake = fakePlayAlong()) {
  fake.store.getState().setBpm(BPM);
  vi.advanceTimersByTime(TAP_AFTER_MS);
  const outcome = fake.store.getState().tap(START_MS + TAP_AFTER_MS);
  return { ...fake, outcome };
}

describe('tap to align', () => {
  it('refuses a tap with no tempo and leaves the engine alone', () => {
    const fake = fakePlayAlong();
    fake.store.getState().watchLibrary();
    expect(fake.store.getState().tap(START_MS)).toEqual({
      locked: false,
      reason: LOCK_REFUSAL.noBpm,
    });
    expect(fake.store.getState().lock).toBeUndefined();
    expect(fake.calls).toEqual([]);
  });

  it('refuses a tap with nothing playing', () => {
    const fake = fakePlayAlong({ sessions: [] });
    fake.store.getState().setBpm(BPM);
    expect(fake.store.getState().tap(START_MS)).toEqual({
      locked: false,
      reason: LOCK_REFUSAL.noSession,
    });
  });

  it('refuses a tap when the app reports no position', () => {
    const fake = fakePlayAlong({ sessions: [snapshot({ positionMs: null })] });
    fake.store.getState().setBpm(BPM);
    expect(fake.store.getState().tap(START_MS)).toEqual({
      locked: false,
      reason: LOCK_REFUSAL.unknownPosition,
    });
    expect(fake.calls).toEqual([]);
  });

  it('refuses a tap while the song is paused', () => {
    const fake = fakePlayAlong({
      sessions: [snapshot({ playing: false, speed: 0 })],
    });
    fake.store.getState().setBpm(BPM);
    expect(fake.store.getState().tap(START_MS)).toEqual({
      locked: false,
      reason: LOCK_REFUSAL.paused,
    });
    expect(fake.calls).toEqual([]);
  });

  it('records the tapped song position as the downbeat and locks', () => {
    const { store, outcome } = tapped();
    expect(outcome).toEqual({ locked: true });
    expect(store.getState().lock).toEqual({
      sessionId: SESSION_ID,
      track: { title: 'Song', artist: 'Band', durationMs: 200_000 },
      downbeatSec: TAP_SONG_SEC,
      bpm: BPM,
      lockedAtBoottimeMs: START_MS + TAP_AFTER_MS,
      phaseOffsetMs: 0,
      downbeatShift: 0,
      downbeatShiftAvailable: true,
    });
  });

  it('anchors the tapped downbeat on a bar line at the tap instant', () => {
    const { anchors } = tapped();
    const now = START_MS + TAP_AFTER_MS;
    expect(anchors()).toEqual([
      [FOUR_FOUR_BARS_BACK * FOUR_FOUR_BAR_SEC, now * FRAMES_PER_MS, BPM],
    ]);
  });

  it('anchors at now a tap that landed a moment ago', () => {
    const fake = fakePlayAlong();
    fake.store.getState().setBpm(BPM);
    vi.advanceTimersByTime(TAP_AFTER_MS + LATE_MS);
    fake.store.getState().tap(START_MS + TAP_AFTER_MS);
    const [songSec, frame] = fake.anchors()[0] ?? [];
    expect(songSec).toBeCloseTo(
      FOUR_FOUR_BARS_BACK * FOUR_FOUR_BAR_SEC + LATE_MS / MS_PER_SECOND,
      9,
    );
    expect(frame).toBe((START_MS + TAP_AFTER_MS + LATE_MS) * FRAMES_PER_MS);
  });

  it.each([
    [3, 4, 1.5],
    [6, 8, 1.5],
    [7, 8, 1.75],
    [5, 4, 2.5],
  ])('scales the bar by the denominator in %d/%d', (beats, denom, barSec) => {
    const fake = fakePlayAlong();
    fake.store.getState().setBeats(beats, denom);
    const { anchors } = tapped(fake);
    const [songSec] = anchors()[0] ?? [];
    const bars = (songSec ?? Number.NaN) / barSec;
    expect(bars).toBeCloseTo(Math.round(bars), 9);
    expect(songSec).toBeGreaterThanOrEqual(0);
    expect(songSec).toBeLessThanOrEqual(TAP_SONG_SEC + barSec);
  });

  it('picks the tapped session so the lock never jumps apps', () => {
    const other = snapshot({ sessionId: OTHER_ID });
    const fake = fakePlayAlong({ sessions: [snapshot(), other] });
    const { pick } = tapped(fake);
    expect(pick).toHaveBeenCalledWith(SESSION_ID);
  });

  it('re-tapping keeps the slot and moves the downbeat', () => {
    const fake = tapped();
    vi.advanceTimersByTime(TAP_AFTER_MS);
    fake.store.getState().tap(START_MS + 2 * TAP_AFTER_MS);
    expect(fake.store.getState().lock?.downbeatSec).toBeCloseTo(
      TAP_SONG_SEC + TAP_AFTER_MS / MS_PER_SECOND,
      9,
    );
    expect(fake.commands.engineHold).toHaveBeenCalledOnce();
    expect(fake.commands.metronomeSelectSlot).toHaveBeenCalledOnce();
    expect(fake.commands.metronomeSelectSlot).toHaveBeenCalledWith(PLAY_ALONG);
  });

  it('re-anchors at once when the tempo changes while locked', () => {
    const fake = tapped();
    fake.store.getState().setBpm(BPM / 2);
    expect(fake.anchors().at(-1)?.[2]).toBe(BPM / 2);
    expect(fake.store.getState().lock?.bpm).toBe(BPM / 2);
  });
});

describe('a tempo entered while locked', () => {
  const ENTERED_BPM = 100;
  const FOUND_BPM = 130;

  it('hands the entered tempo to the tempo ladder', () => {
    const fake = tapped();
    fake.store.getState().setBpm(ENTERED_BPM);
    expect(fake.ladder.ladder.getState().enter).toHaveBeenLastCalledWith(
      ENTERED_BPM,
    );
    expect(fake.ladder.ladder.getState().bpm).toBe(ENTERED_BPM);
  });

  it('keeps the locked tempo when the ladder finds another', () => {
    const fake = tapped();
    fake.store.getState().watchLibrary();
    fake.store.getState().setBpm(ENTERED_BPM);
    fake.ladder.tempo(FOUND_BPM);
    expect(fake.store.getState().lock?.bpm).toBe(ENTERED_BPM);
    expect(fake.store.getState().bpm).toBe(ENTERED_BPM);
  });
});
