import { KB_ACCENT } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { accentLedLabel, accentLedState } from './accentLeds.ts';

describe('accentLedState', () => {
  it('maps each engine accent to its LED', () => {
    expect(accentLedState(KB_ACCENT.KB_ACCENT_ACCENTED)).toBe('accented');
    expect(accentLedState(KB_ACCENT.KB_ACCENT_NORMAL)).toBe('normal');
    expect(accentLedState(KB_ACCENT.KB_ACCENT_MUTED)).toBe('muted');
  });

  it('says the beat and its state', () => {
    expect(accentLedLabel(0, 'muted')).toBe('Beat 1, muted');
  });
});
