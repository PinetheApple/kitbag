import {
  KB_TUNER_NO_NOTE,
  KB_TUNER_NO_STRING,
  KB_TUNING_STATUS,
  KB_WRONG_STRING,
} from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import type { TunerHop } from './hop.ts';
import { nextReading, NO_READING, type DisplayedReading } from './reading.ts';
import { statusSpeech, tuneDirection, tunerCaption } from './readout.ts';

const { KB_TUNING_TOO_LOW, KB_TUNING_TOO_HIGH, KB_TUNING_IN_TUNE } =
  KB_TUNING_STATUS;

const G3 = 55;
const D3 = 50;
const TIGHT_WINDOW = 7;
const WIDE_WINDOW = 12;

function hop(overrides: Partial<TunerHop> = {}): TunerHop {
  return {
    id: 1,
    canHear: true,
    currentString: 3,
    wrongString: KB_TUNER_NO_STRING,
    wrongDirection: KB_WRONG_STRING.KB_WRONG_STRING_NONE,
    status: KB_TUNING_IN_TUNE,
    targetMidi: G3,
    errorCents: 0,
    inTuneRatio: 0,
    inTuneThresholdCents: TIGHT_WINDOW,
    paused: false,
    noSound: false,
    ...overrides,
  };
}

function shown(previousCents: number, next: TunerHop): DisplayedReading {
  const previous = nextReading(
    NO_READING,
    hop({
      targetMidi: next.targetMidi,
      errorCents: previousCents,
      inTuneThresholdCents: next.inTuneThresholdCents,
    }),
  );
  return nextReading(previous, next);
}

function readout(reading: DisplayedReading) {
  return {
    caption: tunerCaption(reading.status, reading.cents),
    direction: tuneDirection(reading.status),
    speech: statusSpeech(reading.status),
  };
}

describe('nextReading: every channel follows the displayed cents', () => {
  it('does not read "−2 CENTS · TUNE DOWN" when the engine hop is high', () => {
    const reading = shown(
      -13,
      hop({ errorCents: 9, status: KB_TUNING_TOO_HIGH }),
    );
    expect(reading.cents).toBe(-2);
    expect(readout(reading)).toEqual({
      caption: 'IN TUNE',
      direction: 'inTune',
      speech: 'In tune',
    });
  });

  it('does not read "+3 CENTS · TUNE DOWN" inside the window', () => {
    const reading = shown(
      -4,
      hop({ errorCents: 10, status: KB_TUNING_TOO_HIGH }),
    );
    expect(reading.cents).toBe(3);
    expect(readout(reading).caption).toBe('IN TUNE');
    expect(readout(reading).direction).toBe('inTune');
  });

  it('does not read IN TUNE with the averaged needle outside the window', () => {
    const reading = shown(
      20,
      hop({ errorCents: 0, status: KB_TUNING_IN_TUNE }),
    );
    expect(reading.cents).toBe(10);
    expect(readout(reading)).toEqual({
      caption: '+10 CENTS · TUNE DOWN',
      direction: 'down',
      speech: 'Tune down',
    });
  });

  it('points the way the displayed cents lean', () => {
    const reading = shown(
      -20,
      hop({ errorCents: 2, status: KB_TUNING_IN_TUNE }),
    );
    expect(reading.cents).toBe(-9);
    expect(readout(reading).caption).toBe('−9 CENTS · TUNE UP');
    expect(readout(reading).direction).toBe('up');
  });

  it('uses the per-string window, compared in whole cents', () => {
    const at = (cents: number, window: number) =>
      nextReading(
        NO_READING,
        hop({ errorCents: cents, inTuneThresholdCents: window }),
      ).status;
    expect(at(-10, WIDE_WINDOW)).toBe(KB_TUNING_IN_TUNE);
    expect(at(-10, TIGHT_WINDOW)).toBe(KB_TUNING_TOO_LOW);
    expect(at(7.4, TIGHT_WINDOW)).toBe(KB_TUNING_IN_TUNE);
    expect(at(7.6, TIGHT_WINDOW)).toBe(KB_TUNING_TOO_HIGH);
    expect(at(-7, TIGHT_WINDOW)).toBe(KB_TUNING_IN_TUNE);
    expect(at(-8, TIGHT_WINDOW)).toBe(KB_TUNING_TOO_LOW);
  });

  it('never names a direction against the sign it prints', () => {
    // The engine's own status follows the raw hop (P18, ±7 c), not the average.
    const engineStatus = (cents: number) => {
      const rounded = Math.round(cents);
      if (rounded < -TIGHT_WINDOW) return KB_TUNING_TOO_LOW;
      if (rounded > TIGHT_WINDOW) return KB_TUNING_TOO_HIGH;
      return KB_TUNING_IN_TUNE;
    };
    for (let before = -30; before <= 30; before += 1.5) {
      for (let now = -30; now <= 30; now += 1.5) {
        const reading = shown(
          before,
          hop({ errorCents: now, status: engineStatus(now) }),
        );
        const rounded = Math.round(reading.cents);
        const direction = tuneDirection(reading.status);
        const label = `${String(before)} then ${String(now)}`;
        if (direction === 'up') expect(rounded, label).toBeLessThan(0);
        if (direction === 'down') expect(rounded, label).toBeGreaterThan(0);
        if (direction === 'inTune') {
          expect(Math.abs(rounded), label).toBeLessThanOrEqual(TIGHT_WINDOW);
        }
      }
    }
  });
});

describe('nextReading: D2 average', () => {
  it('averages successive hops on the same note', () => {
    const first = nextReading(NO_READING, hop({ errorCents: 40 }));
    expect(nextReading(first, hop({ errorCents: 0 })).cents).toBe(20);
  });

  it('starts over when the target note changes', () => {
    const onG = nextReading(NO_READING, hop({ errorCents: 40 }));
    const onD = nextReading(onG, hop({ targetMidi: D3, errorCents: -6 }));
    expect(onD.cents).toBe(-6);
    expect(onD.targetMidi).toBe(D3);
  });

  it('clears on silence, so the next note is shown as-is', () => {
    const heard = nextReading(NO_READING, hop({ errorCents: 40 }));
    const quiet = nextReading(heard, hop({ canHear: false }));
    expect(quiet).toBe(NO_READING);
    expect(nextReading(quiet, hop({ errorCents: -6 })).cents).toBe(-6);
    expect(
      nextReading(heard, hop({ targetMidi: KB_TUNER_NO_NOTE })).targetMidi,
    ).toBe(KB_TUNER_NO_NOTE);
  });
});
