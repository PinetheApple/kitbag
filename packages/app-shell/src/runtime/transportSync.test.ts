import type { TransportEvent } from '@kitbag/core-native';
import type { RampConfig } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  cardStale,
  keepsAppTempo,
  notificationStepAfterAppChange,
  shownAfterNativeChange,
  storePatchFor,
  transportActive,
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
  setlist: null,
  ...over,
});
const shown: TransportShown = {
  playing: true,
  bpm: 120,
  rampRunning: false,
  beatsPerBar: 4,
  beatUnit: 4,
  practicePlayedMs: 5_000,
  practiceStretchStartedAt: 1_000,
  setlist: null,
};
const setlistAt = (index: number) => ({
  subtitle: `Wedding set · Blackbird (${String(index + 1)}/12)`,
});
const CARD_NUMBER = 4;
const FOLLOW = { keepTempo: false };
const KEEP = { keepTempo: true };
const event = (over: Partial<TransportEvent> = {}): TransportEvent => ({
  playback: 'playing',
  bpm: 107,
  rampRunning: false,
  practicePlayedMs: 30_000,
  practiceStretchStartedAt: 7_000,
  cardNumber: CARD_NUMBER,
  tempoSet: false,
  ...over,
});
const pausedShown: TransportShown = {
  ...shown,
  playing: false,
  practicePlayedMs: 30_000,
};

describe('notificationStepAfterAppChange', () => {
  it('shows the notification when playback starts in the app', () => {
    expect(notificationStepAfterAppChange(state(), undefined, 9_000)).toEqual({
      kind: 'show',
      shown,
    });
  });

  it('re-shows only when what the notification displays changed', () => {
    expect(notificationStepAfterAppChange(state(), shown, 9_000)).toEqual({
      kind: 'none',
    });
    expect(
      notificationStepAfterAppChange(state({ bpm: 121 }), shown, 9_000),
    ).toMatchObject({
      kind: 'show',
    });
  });

  it('re-shows after a practice reset so the notification clock follows', () => {
    const reset = state({ practice: { playedMs: 0, stretchStartedAt: 8_000 } });
    expect(notificationStepAfterAppChange(reset, shown, 9_000)).toMatchObject({
      kind: 'show',
      shown: { practicePlayedMs: 0, practiceStretchStartedAt: 8_000 },
    });
  });

  it('hides when the app stops playback', () => {
    expect(
      notificationStepAfterAppChange(state({ running: false }), shown, 9_000),
    ).toEqual({
      kind: 'hide',
    });
  });

  it('keeps a notification paused from the pocket, and play in the app takes it over', () => {
    expect(
      notificationStepAfterAppChange(
        state({
          running: false,
          practice: { playedMs: 30_000, stretchStartedAt: null },
        }),
        pausedShown,
        9_000,
      ),
    ).toEqual({ kind: 'none' });
    expect(
      notificationStepAfterAppChange(state(), pausedShown, 9_000),
    ).toMatchObject({ kind: 'show', shown: { playing: true } });
  });

  it('a reset while paused from the pocket reaches the notification without resuming it', () => {
    expect(
      notificationStepAfterAppChange(
        state({
          running: false,
          practice: { playedMs: 0, stretchStartedAt: null },
        }),
        pausedShown,
        9_000,
      ),
    ).toEqual({
      kind: 'show',
      shown: { ...pausedShown, practicePlayedMs: 0 },
    });
  });

  it('re-shows when the setlist position moves, and not for an equal copy', () => {
    const atThird = { ...shown, setlist: setlistAt(2) };
    expect(
      notificationStepAfterAppChange(
        state({ setlist: setlistAt(2) }),
        atThird,
        9_000,
      ),
    ).toEqual({ kind: 'none' });
    expect(
      notificationStepAfterAppChange(
        state({ setlist: setlistAt(3) }),
        atThird,
        9_000,
      ),
    ).toEqual({ kind: 'show', shown: { ...shown, setlist: setlistAt(3) } });
  });

  it('a song step while paused shows the new song tempo and meter, still paused', () => {
    expect(
      notificationStepAfterAppChange(
        state({
          running: false,
          bpm: 90,
          beatsPerBar: 7,
          denominator: 8,
          ramp: { ...ramp, enabled: true },
          setlist: setlistAt(3),
        }),
        { ...pausedShown, setlist: setlistAt(2) },
        9_000,
      ),
    ).toEqual({
      kind: 'show',
      shown: {
        ...pausedShown,
        bpm: 90,
        beatsPerBar: 7,
        beatUnit: 8,
        rampRunning: true,
        practicePlayedMs: 5_000,
        setlist: setlistAt(3),
      },
    });
  });

  it('re-shows without the setlist once the user leaves it', () => {
    expect(
      notificationStepAfterAppChange(
        state(),
        { ...shown, setlist: setlistAt(2) },
        9_000,
      ),
    ).toEqual({ kind: 'show', shown });
  });

  it('a song step while paused from the pocket moves the setlist without resuming', () => {
    expect(
      notificationStepAfterAppChange(
        state({ running: false, setlist: setlistAt(4) }),
        pausedShown,
        9_000,
      ),
    ).toEqual({
      kind: 'show',
      shown: {
        ...pausedShown,
        practicePlayedMs: 5_000,
        setlist: setlistAt(4),
      },
    });
  });
});

describe('shownAfterNativeChange', () => {
  it('follows a tempo change from the notification, so the app does not re-send it', () => {
    const next = shownAfterNativeChange(shown, event({ bpm: 121 }), FOLLOW);
    const app = state({
      bpm: 121,
      practice: { playedMs: 30_000, stretchStartedAt: 7_000 },
    });
    expect(notificationStepAfterAppChange(app, next, 9_000)).toEqual({
      kind: 'none',
    });
  });

  it('forgets the notification once it was stopped natively', () => {
    expect(
      shownAfterNativeChange(shown, event({ playback: 'stopped' }), FOLLOW),
    ).toBeUndefined();
  });

  it('a Play from a service still on the previous card keeps the shown tempo', () => {
    expect(
      shownAfterNativeChange(
        { ...pausedShown, bpm: 90 },
        event({ bpm: 120 }),
        KEEP,
      ),
    ).toMatchObject({ playing: true, bpm: 90 });
  });
});

describe('storePatchFor', () => {
  const current = { bpm: 100, ramp: { ...ramp, enabled: true } };

  it('a tempo change from the notification sets the tempo and clears the ramp chip', () => {
    expect(storePatchFor(event(), current, FOLLOW)).toMatchObject({
      running: true,
      bpm: 107,
      ramp: { ...ramp, enabled: false },
    });
  });

  it('the practice clock follows the service, which timed the pause and resume itself', () => {
    expect(storePatchFor(event(), current, FOLLOW).practice).toEqual({
      playedMs: 30_000,
      stretchStartedAt: 7_000,
    });
    expect(
      storePatchFor(event({ playback: 'paused' }), current, FOLLOW).practice,
    ).toEqual({ playedMs: 30_000, stretchStartedAt: null });
  });

  it('a pause during a ramp leaves the ramp and its base tempo alone', () => {
    expect(
      storePatchFor(
        event({ playback: 'paused', bpm: 112, rampRunning: true }),
        current,
        KEEP,
      ),
    ).toMatchObject({
      running: false,
      bpm: 100,
      ramp: { ...ramp, enabled: true },
    });
  });

  it('a kept tempo leaves the app tempo and ramp alone', () => {
    expect(storePatchFor(event({ bpm: 120 }), current, KEEP)).toMatchObject({
      running: true,
      bpm: 100,
      ramp: { ...ramp, enabled: true },
    });
  });
});

describe('keepsAppTempo', () => {
  const STALE = true;
  const CURRENT = false;

  it('keeps the app tempo during a ramp, or when a service on another card did not set one', () => {
    expect(keepsAppTempo(event({ rampRunning: true }), CURRENT)).toBe(true);
    expect(keepsAppTempo(event(), STALE)).toBe(true);
    expect(keepsAppTempo(event(), CURRENT)).toBe(false);
  });

  it('a tempo step on the previous card still takes the tempo the service set', () => {
    expect(keepsAppTempo(event({ tempoSet: true }), STALE)).toBe(false);
  });
});

describe('cardStale', () => {
  it('is stale when the numbers differ either way, and never without a shown card', () => {
    const before = event({ cardNumber: CARD_NUMBER - 1 });
    const after = event({ cardNumber: CARD_NUMBER + 1 });
    expect(cardStale(shown, before, CARD_NUMBER)).toBe(true);
    expect(cardStale(shown, after, CARD_NUMBER)).toBe(true);
    expect(cardStale(shown, event(), CARD_NUMBER)).toBe(false);
    expect(cardStale(undefined, after, CARD_NUMBER)).toBe(false);
  });
});

describe('transportActive', () => {
  it('counts a metronome paused behind its notification as active', () => {
    expect(transportActive(false, pausedShown)).toBe(true);
    expect(transportActive(true, undefined)).toBe(true);
    expect(transportActive(false, undefined)).toBe(false);
  });
});
