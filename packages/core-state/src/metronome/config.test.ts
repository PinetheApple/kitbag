import { KB_SOUND_NAMES } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { mergeSounds } from './config.ts';

const PREV = { normal: 0, accent: 1 } as const;
const VALID = KB_SOUND_NAMES.length - 1;
const INVALID = -1;

describe('mergeSounds', () => {
  it('takes both sounds when both are valid', () => {
    expect(mergeSounds(PREV, VALID, VALID)).toEqual({
      normal: VALID,
      accent: VALID,
    });
  });

  it('keeps the previous sound in place of an invalid id', () => {
    expect(mergeSounds(PREV, INVALID, VALID)).toEqual({
      normal: PREV.normal,
      accent: VALID,
    });
    expect(mergeSounds(PREV, VALID, INVALID)).toEqual({
      normal: VALID,
      accent: PREV.accent,
    });
  });

  it('gives nothing when neither id is valid', () => {
    expect(mergeSounds(PREV, INVALID, INVALID)).toBeUndefined();
  });
});
