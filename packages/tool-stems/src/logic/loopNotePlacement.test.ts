import { stemPlayer } from '@kitbag/core-design';
import { describe, expect, it } from 'vitest';

import { loopNotePlacement, type LaneGeometry } from './loopNotePlacement.ts';

const LANE: Readonly<Record<string, LaneGeometry>> = {
  '360 at 1.0': { laneWidth: 328, barLeft: 57, barWidth: 215 },
  '411 at 1.0': { laneWidth: 379, barLeft: 57, barWidth: 266 },
  '360 at 2.0': { laneWidth: 328, barLeft: 82, barWidth: 164 },
  '411 at 2.0': { laneWidth: 379, barLeft: 82, barWidth: 215 },
};
// Widths read off the emulator shots of "Outro · 4:08 – 5:11".
const NOTE_AT_1X = 121;
const NOTE_AT_2X = 234;
const LOOPS = {
  early: { start: 0.05, end: 0.15 },
  middle: { start: 0.45, end: 0.55 },
  late: { start: 0.8, end: 1 },
  wide: { start: 0.25, end: 0.9 },
};

function flagSpan(lane: LaneGeometry, start: number, end: number) {
  const flag = stemPlayer.loopFlagWidth;
  return {
    left: lane.barLeft + start * lane.barWidth - flag,
    right: lane.barLeft + end * lane.barWidth + flag,
  };
}

describe('loopNotePlacement', () => {
  it.each([
    ['360 at 1.0', 'early', NOTE_AT_1X, 'right'],
    ['360 at 1.0', 'middle', NOTE_AT_1X, 'right'],
    ['360 at 1.0', 'late', NOTE_AT_1X, 'left'],
    ['360 at 1.0', 'wide', NOTE_AT_1X, 'above'],
    ['411 at 1.0', 'early', NOTE_AT_1X, 'right'],
    ['411 at 1.0', 'middle', NOTE_AT_1X, 'right'],
    ['411 at 1.0', 'late', NOTE_AT_1X, 'left'],
    ['360 at 2.0', 'early', NOTE_AT_2X, 'above'],
    ['360 at 2.0', 'middle', NOTE_AT_2X, 'above'],
    ['360 at 2.0', 'late', NOTE_AT_2X, 'above'],
    ['411 at 2.0', 'early', NOTE_AT_2X, 'right'],
    ['411 at 2.0', 'middle', NOTE_AT_2X, 'above'],
    ['411 at 2.0', 'late', NOTE_AT_2X, 'above'],
  ] as const)('%s, %s loop, note %d wide: %s', (lane, loop, width, want) => {
    const geometry = LANE[lane];
    if (geometry === undefined) throw new Error(lane);
    expect(
      loopNotePlacement({ ...geometry, ...LOOPS[loop], noteWidth: width }),
    ).toBe(want);
  });

  it('never puts the note over a flag, in any lane or loop', () => {
    for (const lane of Object.values(LANE))
      for (const { start, end } of Object.values(LOOPS))
        for (const noteWidth of [NOTE_AT_1X, NOTE_AT_2X]) {
          const place = loopNotePlacement({
            ...lane,
            start,
            end,
            noteWidth,
          });
          const flags = flagSpan(lane, start, end);
          if (place === 'right')
            expect(lane.laneWidth - noteWidth).toBeGreaterThan(flags.right);
          if (place === 'left') expect(noteWidth).toBeLessThan(flags.left);
        }
  });

  it('keeps the drawn place with nothing measured or no flags', () => {
    const lane = { laneWidth: 0, barLeft: 0, barWidth: 0 };
    expect(
      loopNotePlacement({ ...lane, start: 0.8, end: 1, noteWidth: 0 }),
    ).toBe('right');
    expect(
      loopNotePlacement({
        laneWidth: 328,
        barLeft: 57,
        barWidth: 215,
        start: null,
        end: null,
        noteWidth: 300,
      }),
    ).toBe('right');
  });

  it('clears the one flag of an armed loop', () => {
    const lane = { laneWidth: 328, barLeft: 57, barWidth: 215 };
    expect(
      loopNotePlacement({ ...lane, start: 0.95, end: null, noteWidth: 121 }),
    ).toBe('left');
    expect(
      loopNotePlacement({ ...lane, start: 0.5, end: null, noteWidth: 121 }),
    ).toBe('right');
  });
});
