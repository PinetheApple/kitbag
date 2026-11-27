import { KB_ACCENT } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { cycledAccents } from './patternEdit.ts';

const {
  KB_ACCENT_ACCENTED: A,
  KB_ACCENT_NORMAL: N,
  KB_ACCENT_MUTED: M,
} = KB_ACCENT;

describe('cycledAccents', () => {
  it('cycles only the tapped beat, as the metronome dots do', () => {
    expect(cycledAccents([A, N, N, N], 1)).toEqual([A, M, N, N]);
    expect(cycledAccents([A, N, N, N], 0)).toEqual([N, N, N, N]);
  });

  it('leaves a beat outside the bar alone', () => {
    expect(cycledAccents([A, N], 2)).toEqual([A, N]);
  });
});
