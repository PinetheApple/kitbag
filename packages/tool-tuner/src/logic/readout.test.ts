import { KB_TUNING_STATUS } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import {
  NEEDLE_FULL_SCALE_CENTS,
  NEEDLE_FULL_SCALE_TRAVEL,
  needleFraction,
  statusSpeech,
  tuneDirection,
  tunerCaption,
} from './readout.ts';

const {
  KB_TUNING_TOO_LOW,
  KB_TUNING_TOO_HIGH,
  KB_TUNING_IN_TUNE,
  KB_TUNING_NOT_MEASURED,
} = KB_TUNING_STATUS;

describe('needleFraction', () => {
  it('is linear in cents with ±220 c at 80 % of the half-width', () => {
    expect(NEEDLE_FULL_SCALE_CENTS).toBe(220);
    expect(NEEDLE_FULL_SCALE_TRAVEL).toBe(0.8);
    expect(needleFraction(0)).toBe(0);
    expect(needleFraction(220)).toBeCloseTo(0.8, 12);
    expect(needleFraction(-220)).toBeCloseTo(-0.8, 12);
    expect(needleFraction(-50)).toBeCloseTo(-0.18, 2);
  });

  it('moves visibly for a slightly-out string: no dead zone', () => {
    expect(needleFraction(7)).toBeCloseTo(0.025, 3);
    expect(needleFraction(1)).toBeGreaterThan(0);
    expect(needleFraction(-1)).toBeLessThan(0);
  });

  it('pins at 80 % past full scale, inside the strip contract', () => {
    expect(needleFraction(500)).toBeCloseTo(0.8, 12);
    expect(needleFraction(-1200)).toBeCloseTo(-0.8, 12);
  });

  it('parks on the centre line for a missing reading', () => {
    expect(needleFraction(Number.NaN)).toBe(0);
    expect(needleFraction(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('tunerCaption', () => {
  it('matches the design wording', () => {
    expect(tunerCaption(KB_TUNING_TOO_LOW, -4.3)).toBe('−4 CENTS · TUNE UP');
    expect(tunerCaption(KB_TUNING_TOO_HIGH, 12.6)).toBe(
      '+13 CENTS · TUNE DOWN',
    );
    expect(tunerCaption(KB_TUNING_TOO_LOW, -1)).toBe('−1 CENT · TUNE UP');
  });

  it('says IN TUNE without a number', () => {
    expect(tunerCaption(KB_TUNING_IN_TUNE, -3)).toBe('IN TUNE');
  });

  it('takes the direction from the status, not the sign', () => {
    expect(tunerCaption(KB_TUNING_TOO_HIGH, -8)).toBe('−8 CENTS · TUNE DOWN');
  });

  it('is empty with nothing measured', () => {
    expect(tunerCaption(KB_TUNING_NOT_MEASURED, 0)).toBe('');
  });
});

describe('tuneDirection and statusSpeech', () => {
  it('agree on every status', () => {
    expect(tuneDirection(KB_TUNING_TOO_LOW)).toBe('up');
    expect(tuneDirection(KB_TUNING_TOO_HIGH)).toBe('down');
    expect(tuneDirection(KB_TUNING_IN_TUNE)).toBe('inTune');
    expect(tuneDirection(KB_TUNING_NOT_MEASURED)).toBe('none');
    expect(statusSpeech(KB_TUNING_TOO_LOW)).toBe('Tune up');
    expect(statusSpeech(KB_TUNING_TOO_HIGH)).toBe('Tune down');
    expect(statusSpeech(KB_TUNING_IN_TUNE)).toBe('In tune');
    expect(statusSpeech(KB_TUNING_NOT_MEASURED)).toBe('');
  });
});
