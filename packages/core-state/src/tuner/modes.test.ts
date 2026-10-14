import {
  KB_TUNER_AUTO_STRING,
  KB_TUNER_MAX_STRINGS,
} from '@kitbag/core-native';
import { beforeEach, describe, expect, it } from 'vitest';

import { allStringsTuned } from './store.ts';
import {
  createHarness,
  DROP_D,
  GUITAR,
  settle,
  type Harness,
} from './store.test-helper.ts';

let fakes: Harness['fakes'];
let s: Harness['s'];

beforeEach(() => {
  ({ fakes, s } = createHarness());
});

describe('modes', () => {
  beforeEach(async () => {
    s().enter(GUITAR);
    await settle();
    fakes.calls.length = 0;
  });

  it('auto → manual → chromatic → auto sends one command each', async () => {
    s().lockString(4);
    expect(s().mode).toEqual({ kind: 'manual', string: 4 });
    s().setChromatic();
    expect(s().mode).toEqual({ kind: 'chromatic' });
    s().setAuto();
    expect(s().mode).toEqual({ kind: 'auto' });
    await settle();
    expect(fakes.calls).toEqual([
      ['tunerSetTargetString', 4],
      ['tunerSetChromatic'],
      ['tunerSetTargetString', KB_TUNER_AUTO_STRING],
    ]);
  });

  it('ignores a string the tuning does not have', async () => {
    s().lockString(GUITAR.notes.length);
    s().lockString(-1);
    s().lockString(1.5);
    await settle();
    expect(s().mode).toEqual({ kind: 'auto' });
    expect(fakes.calls).toEqual([]);
  });

  it('a new tuning returns to auto and clears tuned strings, like the engine', async () => {
    s().lockString(2);
    s().markTuned(2);
    s().setTuning(DROP_D);
    expect(s().mode).toEqual({ kind: 'auto' });
    expect(s().tunedStrings).toEqual([]);
    await settle();
    expect(fakes.calls.at(-1)).toEqual([
      'tunerSetTuning',
      DROP_D.instrument,
      DROP_D.notes,
    ]);
  });

  it('rejects a tuning the engine would refuse', async () => {
    s().setTuning({ ...GUITAR, notes: [] });
    s().setTuning({
      ...GUITAR,
      notes: Array<number>(KB_TUNER_MAX_STRINGS + 1).fill(40),
    });
    s().setTuning({ ...GUITAR, instrument: 99 });
    s().setTuning({ ...GUITAR, notes: [40, 128] });
    await settle();
    expect(s().tuning).toEqual(GUITAR);
    expect(fakes.calls).toEqual([]);
  });

  it('sends nothing while the screen is closed; enter pushes it all', async () => {
    s().leave();
    await settle();
    fakes.calls.length = 0;
    s().setA4(432);
    s().setChromatic();
    await settle();
    expect(fakes.calls).toEqual([]);
    s().enter(GUITAR);
    await settle();
    expect(fakes.calls).toContainEqual(['tunerSetA4', 432]);
  });
});

describe('markTuned', () => {
  beforeEach(async () => {
    s().enter(GUITAR);
    await settle();
  });

  it('marks a string tuned once', () => {
    expect(s().markTuned(3)).toBe(true);
    expect(s().markTuned(3)).toBe(false);
    expect(s().markTuned(1)).toBe(true);
    expect(s().tunedStrings).toEqual([1, 3]);
  });

  it('survives mode switches (only re-entry clears it)', () => {
    s().markTuned(0);
    s().lockString(1);
    s().setAuto();
    expect(s().tunedStrings).toEqual([0]);
  });

  it('ignores chromatic mode and unknown strings', () => {
    expect(s().markTuned(GUITAR.notes.length)).toBe(false);
    s().setChromatic();
    expect(s().markTuned(0)).toBe(false);
    expect(s().tunedStrings).toEqual([]);
  });

  it('reports all strings tuned', () => {
    GUITAR.notes.forEach((_, i) => {
      expect(allStringsTuned(s())).toBe(false);
      s().markTuned(i);
    });
    expect(allStringsTuned(s())).toBe(true);
  });
});
