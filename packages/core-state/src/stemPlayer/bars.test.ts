import { describe, expect, it } from 'vitest';

import { barMarkDownbeats } from './bars.ts';

describe('downbeat indices from bar marks', () => {
  it('opens a bar every beatsPerBar beats from each mark', () => {
    expect(barMarkDownbeats([{ beat: 1, beatsPerBar: 3 }], 11)).toEqual([
      1, 4, 7, 10,
    ]);
  });

  it('restarts the count where the meter changes', () => {
    expect(
      barMarkDownbeats(
        [
          { beat: 0, beatsPerBar: 4 },
          { beat: 6, beatsPerBar: 3 },
        ],
        13,
      ),
    ).toEqual([0, 4, 6, 9, 12]);
  });

  it('stops at the grid the click was given', () => {
    expect(barMarkDownbeats([{ beat: 0, beatsPerBar: 2 }], 5)).toEqual([
      0, 2, 4,
    ]);
    expect(barMarkDownbeats([{ beat: 7, beatsPerBar: 4 }], 5)).toEqual([]);
  });

  it('has none without marks', () => {
    expect(barMarkDownbeats([], 8)).toEqual([]);
  });
});
