import { stemPlayer } from '@kitbag/core-design';
import { describe, expect, it } from 'vitest';

import { LANE, NOTE_AT_1X, NOTE_AT_2X } from './loopNote.test-helper.ts';
import {
  aboveFlagsPadding,
  loopNotePlacement,
  type LaneGeometry,
} from './loopNotePlacement.ts';

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
    expect(
      loopNotePlacement({ ...LANE[lane], ...LOOPS[loop], noteWidth: width }),
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
    const unmeasured = { laneWidth: 0, barLeft: 0, barWidth: 0 };
    expect(
      loopNotePlacement({ ...unmeasured, start: 0.8, end: 1, noteWidth: 0 }),
    ).toBe('right');
    expect(
      loopNotePlacement({
        ...LANE['360 at 1.0'],
        start: null,
        end: null,
        noteWidth: NOTE_AT_2X,
      }),
    ).toBe('right');
  });

  it('clears the one flag of an armed loop', () => {
    const lane = LANE['360 at 1.0'];
    expect(
      loopNotePlacement({
        ...lane,
        start: 0.95,
        end: null,
        noteWidth: NOTE_AT_1X,
      }),
    ).toBe('left');
    expect(
      loopNotePlacement({
        ...lane,
        start: 0.5,
        end: null,
        noteWidth: NOTE_AT_1X,
      }),
    ).toBe('right');
  });

  describe('at the edge of a flag', () => {
    const lane = LANE['360 at 1.0'];
    const start = 0.5;
    const end = 0.5;
    const flag = stemPlayer.loopFlagWidth;
    const clearance = stemPlayer.loopNoteFlagClearance;
    const line = lane.barLeft + end * lane.barWidth;
    const place = (noteWidth: number, loop = { start, end }) =>
      loopNotePlacement({ ...lane, ...loop, noteWidth });

    it('takes the right only once the note clears the B flag', () => {
      const roomForAll = lane.laneWidth - (line + flag + clearance);
      expect(place(roomForAll)).toBe('right');
      expect(place(roomForAll + flag / 2)).not.toBe('right');
    });

    it('takes the left only once the note clears the A flag', () => {
      const wide = { start: 0.5, end: 1 };
      const roomForAll = line - flag - clearance;
      expect(place(roomForAll, wide)).toBe('left');
      expect(place(roomForAll + flag / 2, wide)).toBe('above');
    });
  });
});

describe('aboveFlagsPadding', () => {
  it('lifts the flags clear of the note', () => {
    expect(aboveFlagsPadding(30)).toBe(48);
  });
});
