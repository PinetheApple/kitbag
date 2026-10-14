import { KB_TUNING_STATUS } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import {
  NEEDLE_FULL_SCALE_CENTS,
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
  it('maps ±50 cents to the strip ends', () => {
    expect(NEEDLE_FULL_SCALE_CENTS).toBe(50);
    expect(needleFraction(0)).toBe(0);
    expect(needleFraction(-50)).toBe(-1);
    expect(needleFraction(25)).toBe(0.5);
    expect(needleFraction(-4)).toBeCloseTo(-0.08);
  });

  it('pins past full scale instead of leaving the strip', () => {
    expect(needleFraction(51)).toBe(1);
    expect(needleFraction(400)).toBe(1);
    expect(needleFraction(-1200)).toBe(-1);
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
