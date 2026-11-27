import { describe, expect, it } from 'vitest';

import {
  FIRST_STRIP_BEAT,
  isStripDownbeat,
  stripPlayheadFraction,
  stripWindowStart,
} from './beatStripWindow.ts';
import { manualTempo } from './manualTempoRoles.ts';

const LAST_IN_FIRST_WINDOW = FIRST_STRIP_BEAT + manualTempo.stripBeats - 1;

describe('the beat strip window', () => {
  it('stays put while the playhead is inside it', () => {
    expect(stripWindowStart(FIRST_STRIP_BEAT, 0)).toBe(FIRST_STRIP_BEAT);
    expect(stripWindowStart(FIRST_STRIP_BEAT, LAST_IN_FIRST_WINDOW)).toBe(
      FIRST_STRIP_BEAT,
    );
  });

  it('recentres on the playhead once it leaves, either way', () => {
    const later = stripWindowStart(FIRST_STRIP_BEAT, 400.2);
    expect(later).toBe(400 + FIRST_STRIP_BEAT);
    expect(stripPlayheadFraction(later, 400.2)).toBeGreaterThan(0);
    expect(stripWindowStart(later, 3)).toBe(3 + FIRST_STRIP_BEAT);
  });

  it('puts the playhead on the centre of its beat', () => {
    expect(stripPlayheadFraction(FIRST_STRIP_BEAT, 0)).toBeCloseTo(
      1.5 / manualTempo.stripBeats,
    );
  });

  it('marks every bar from bar 1, before it too', () => {
    expect([-4, 0, 4, 8].every((beat) => isStripDownbeat(beat, 4))).toBe(true);
    expect(isStripDownbeat(-3, 3)).toBe(true);
    expect(isStripDownbeat(2, 4)).toBe(false);
  });
});
