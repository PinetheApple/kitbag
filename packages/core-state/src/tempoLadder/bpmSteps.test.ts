import { describe, expect, it } from 'vitest';

import { BPM_BOUNDS } from '../metronome/config.ts';
import { doubledBpm, halvedBpm } from './bpmSteps.ts';

describe('halving and doubling', () => {
  it('fixes a half- or double-time lookup', () => {
    expect(halvedBpm(171)).toBe(85.5);
    expect(doubledBpm(85.5)).toBe(171);
  });

  it('stays inside the metronome range', () => {
    expect(halvedBpm(BPM_BOUNDS.min + 1)).toBe(BPM_BOUNDS.min);
    expect(doubledBpm(BPM_BOUNDS.max - 1)).toBe(BPM_BOUNDS.max);
  });
});
