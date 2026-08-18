import { describe, expect, it } from 'vitest';

import {
  clampBpm,
  dragTempo,
  dragBpmDelta,
  DP_PER_BPM,
  flingBpmDelta,
} from './swipeTempo.ts';
import type { BpmBounds } from './bpmBounds.ts';

// Mirrors core-state's BPM_BOUNDS shape; the gesture passes the real one.
const BOUNDS: BpmBounds = { min: 20, max: 400 };

// SPEC §5.2 fixes the travel, so the test states it as a number rather than
// through the constant — otherwise retuning the constant passes silently.
const SPEC_DP_PER_BPM = 8;

describe('dragBpmDelta', () => {
  it('travels the 8dp per BPM SPEC §5.2 asks for', () => {
    expect(DP_PER_BPM).toBe(SPEC_DP_PER_BPM);
    expect(dragBpmDelta(-SPEC_DP_PER_BPM)).toBe(1);
  });

  it('gives +1 BPM per 8dp dragged up, -1 per 8dp down (SPEC §5.2)', () => {
    expect(dragBpmDelta(-DP_PER_BPM)).toBe(1);
    expect(dragBpmDelta(DP_PER_BPM)).toBe(-1);
    expect(dragBpmDelta(-DP_PER_BPM * 10)).toBe(10);
  });

  it('holds the tempo until a full step is travelled', () => {
    expect(dragBpmDelta(-(DP_PER_BPM - 1))).toBe(0);
    expect(dragBpmDelta(DP_PER_BPM - 1)).toBe(0);
  });
});

describe('dragTempo', () => {
  it('carries the anchor unchanged while the drag stays in range', () => {
    const step = dragTempo(120, -DP_PER_BPM * 4, BOUNDS);
    expect(step).toEqual({ bpm: 124, anchorBpm: 120 });
  });

  // The composition is where the dead travel lives: clamping the value while
  // the anchor stays put means a drag that overshot has to be pulled all the
  // way back before the tempo moves. Replays one drag, sample by sample.
  it('moves on the next step after a drag reverses at the ceiling', () => {
    const samples = [-DP_PER_BPM * 30, -DP_PER_BPM * 29, -DP_PER_BPM * 28];
    let anchor = 390;
    const reached = samples.map((translationY) => {
      const step = dragTempo(anchor, translationY, BOUNDS);
      anchor = step.anchorBpm;
      return step.bpm;
    });
    expect(reached).toEqual([BOUNDS.max, BOUNDS.max - 1, BOUNDS.max - 2]);
  });

  it('re-cuts the anchor at the floor the same way', () => {
    const down = dragTempo(30, DP_PER_BPM * 30, BOUNDS);
    expect(down.bpm).toBe(BOUNDS.min);
    expect(dragTempo(down.anchorBpm, DP_PER_BPM * 29, BOUNDS).bpm).toBe(
      BOUNDS.min + 1,
    );
  });
});

describe('clampBpm', () => {
  it('holds a tempo inside the range and pins one outside it', () => {
    expect(clampBpm(120, BOUNDS)).toBe(120);
    expect(clampBpm(1, BOUNDS)).toBe(BOUNDS.min);
    expect(clampBpm(10000, BOUNDS)).toBe(BOUNDS.max);
  });
});

describe('flingBpmDelta', () => {
  it('throws upward on an upward flick and downward on a downward one', () => {
    expect(flingBpmDelta(-2000)).toBeGreaterThan(0);
    expect(flingBpmDelta(2000)).toBeLessThan(0);
  });

  it('jumps further than the same distance dragged slowly would', () => {
    expect(flingBpmDelta(-2000)).toBeGreaterThan(flingBpmDelta(-500));
  });

  it('caps a hard flick so one gesture cannot cross the range', () => {
    const hard = flingBpmDelta(-100000);
    expect(hard).toBe(flingBpmDelta(-200000));
    expect(hard).toBeLessThanOrEqual(40);
  });

  it('does not move the tempo when the finger is still', () => {
    expect(flingBpmDelta(0)).toBe(0);
  });
});
