import type { TransportEvent } from '@kitbag/core-native';
import type { RampConfig } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  notificationStepAfterAppChange,
  shownAfterNativeChange,
  storePatchFor,
  type TransportShown,
  type TransportSource,
} from './transportSync';

const ramp: RampConfig = {
  enabled: false,
  startBpm: 100,
  targetBpm: 140,
  stepBpm: 5,
  interval: 4,
  unit: 0,
  loop: false,
};
const state = (over: Partial<TransportSource> = {}): TransportSource => ({
  running: true,
  bpm: 120,
  beatsPerBar: 4,
  denominator: 4,
  ramp,
  practice: { playedMs: 5_000, stretchStartedAt: 1_000 },
  ...over,
});
const shown: TransportShown = {
  bpm: 120,
  rampRunning: false,
  beatsPerBar: 4,
  beatUnit: 4,
  practicePlayedMs: 5_000,
  practiceStartedAt: 1_000,
};
const event = (over: Partial<TransportEvent> = {}): TransportEvent => ({
  playback: 'playing',
  bpm: 107,
  rampRunning: false,
  ...over,
});

describe('notificationStepAfterAppChange', () => {
  it('shows the notification when playback starts in the app', () => {
    expect(
      notificationStepAfterAppChange(state(), undefined, false, 9_000),
    ).toEqual({
      kind: 'show',
      shown,
    });
  });

  it('re-shows only when what the notification displays changed', () => {
    expect(
      notificationStepAfterAppChange(state(), shown, false, 9_000),
    ).toEqual({
      kind: 'none',
    });
    expect(
      notificationStepAfterAppChange(state({ bpm: 121 }), shown, false, 9_000),
    ).toMatchObject({
      kind: 'show',
    });
  });

  it('re-shows after a practice reset so the notification clock follows', () => {
    const reset = state({ practice: { playedMs: 0, stretchStartedAt: 8_000 } });
    expect(
      notificationStepAfterAppChange(reset, shown, false, 9_000),
    ).toMatchObject({
      kind: 'show',
      shown: { practicePlayedMs: 0, practiceStartedAt: 8_000 },
    });
  });

  it('hides when the app stops playback', () => {
    expect(
      notificationStepAfterAppChange(
        state({ running: false }),
        shown,
        false,
        9_000,
      ),
    ).toEqual({
      kind: 'hide',
    });
  });

  it('keeps a notification paused from the pocket, and play in the app takes it over', () => {
    expect(
      notificationStepAfterAppChange(
        state({ running: false }),
        shown,
        true,
        9_000,
      ),
    ).toEqual({
      kind: 'none',
    });
    expect(
      notificationStepAfterAppChange(state(), shown, true, 9_000),
    ).toMatchObject({
      kind: 'show',
    });
  });
});

describe('shownAfterNativeChange', () => {
  it('follows a tempo change from the notification, so the app does not re-send it', () => {
    const next = shownAfterNativeChange(shown, event({ bpm: 121 }));
    expect(next).toEqual({ ...shown, bpm: 121 });
    expect(
      notificationStepAfterAppChange(state({ bpm: 121 }), next, false, 9_000),
    ).toEqual({ kind: 'none' });
  });

  it('forgets the notification once it was stopped natively', () => {
    expect(
      shownAfterNativeChange(shown, event({ playback: 'stopped' })),
    ).toBeUndefined();
  });
});

describe('storePatchFor', () => {
  const current = { bpm: 100, ramp: { ...ramp, enabled: true } };

  it('a tempo change from the notification sets the tempo and clears the ramp chip', () => {
    expect(storePatchFor(event(), current)).toEqual({
      running: true,
      bpm: 107,
      ramp: { ...ramp, enabled: false },
    });
  });

  it('a pause during a ramp leaves the ramp and its base tempo alone', () => {
    expect(
      storePatchFor(
        event({ playback: 'paused', bpm: 112, rampRunning: true }),
        current,
      ),
    ).toEqual({
      running: false,
      bpm: 100,
      ramp: { ...ramp, enabled: true },
    });
  });
});
