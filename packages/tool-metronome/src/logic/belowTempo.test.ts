import { metronome, space } from '@kitbag/core-design';
import { KB_MAX_BEATS } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import {
  beatDotsHeight,
  beatLinePitch,
  belowTempoReserve,
  DOT_METRICS,
  tallestBelowTempo,
  type BelowTempoRoom,
} from './belowTempo.ts';
import { beatDotSize, layoutBeatLeds, MAX_DOTS_PER_LINE } from './ledLayout.ts';

const SMALL_PHONE_DOTS_WIDTH = 360 - space.screenInset * 2;
const LARGE_PHONE_DOTS_WIDTH = 411 - space.screenInset * 2;
const FONT_SCALES = [1, 1.3] as const;
const BEAT_COUNTS = Array.from({ length: KB_MAX_BEATS }, (_u, i) => i + 1);

// Where the dots start and where the body ends above the transport: large is
// the emulator at fontScale 1.0 (build 8663a62), small the approved #243 mockup.
const MEASURED = {
  small: { dotsTop: 418, bodyBottom: 658 },
  large: { dotsTop: 436.4, bodyBottom: 813.8 },
} as const;

const SMALL_COMPACT: BelowTempoRoom = {
  width: SMALL_PHONE_DOTS_WIDTH,
  density: 'compact',
  fontScale: 1,
};

const LARGE_ROOMY: BelowTempoRoom = {
  width: LARGE_PHONE_DOTS_WIDTH,
  density: 'roomy',
  fontScale: 1,
};

interface Rendered {
  readonly beatCount: number;
  readonly poly: boolean;
  readonly labelAbove: boolean;
  readonly fontScale: number;
}

// Stacks the boxes BeatDots, PolyDots, the legend and StatusStack draw on a
// roomy screen, stopped and running.
function renderedRoomy(shape: Rendered): number {
  const lines = layoutBeatLeds(shape.beatCount, MAX_DOTS_PER_LINE);
  const dot = beatDotSize(lines, LARGE_PHONE_DOTS_WIDTH, DOT_METRICS);
  const label = metronome.beatMarkerLineHeight * shape.fontScale;
  const beat =
    dot +
    metronome.beatMarkerGap +
    metronome.pulseMark +
    metronome.beatMarkerGap +
    label;
  let dots =
    lines.length * beat + (lines.length - 1) * metronome.beatDotLineGap;
  if (shape.poly) {
    dots += metronome.beatDotLineGap + metronome.polyRow;
    if (shape.labelAbove) dots += label + metronome.beatMarkerGap;
  }
  const legend = metronome.legendTop + metronome.legendRow * shape.fontScale;
  const stopped = legend + metronome.statusRow;
  const running = metronome.statusRow * 2 + metronome.statusRowGap;
  return dots + Math.max(stopped, running);
}

describe('belowTempoReserve', () => {
  it('holds every meter, poly and poly-label place on a roomy screen', () => {
    for (const fontScale of FONT_SCALES) {
      const reserve = belowTempoReserve({ ...LARGE_ROOMY, fontScale });
      for (const beatCount of BEAT_COUNTS) {
        for (const poly of [false, true]) {
          for (const labelAbove of [false, true]) {
            expect(
              renderedRoomy({ beatCount, poly, labelAbove, fontScale }),
            ).toBeLessThanOrEqual(reserve);
          }
        }
      }
    }
  });

  it('reserves no more than the tallest song draws', () => {
    for (const fontScale of FONT_SCALES) {
      const tallest = Math.max(
        ...BEAT_COUNTS.map((beatCount) =>
          renderedRoomy({ beatCount, poly: true, labelAbove: true, fontScale }),
        ),
      );
      expect(belowTempoReserve({ ...LARGE_ROOMY, fontScale })).toBeCloseTo(
        tallest,
      );
    }
  });

  it('reserves nothing on a compact screen, whose density the window fixes', () => {
    expect(belowTempoReserve(SMALL_COMPACT)).toBe(0);
  });
});

describe('the body at fontScale 1.0', () => {
  it('fits the roomy reserve above the transport at 411 x 914', () => {
    const budget = MEASURED.large.bodyBottom - MEASURED.large.dotsTop;
    expect(belowTempoReserve(LARGE_ROOMY)).toBeLessThanOrEqual(budget);
  });

  it('fits every song with its poly label beside the dots at 360 x 800', () => {
    const budget = MEASURED.small.bodyBottom - MEASURED.small.dotsTop;
    expect(tallestBelowTempo('labelBeside', SMALL_COMPACT)).toBeLessThanOrEqual(
      budget,
    );
  });
});

describe('beatLinePitch', () => {
  const TWELVE_EIGHT = { beatCount: 12, poly: 'off' } as const;
  const dot = metronome.beatDotMaxCompactMultiLine;
  const cell =
    metronome.beatMarkerGap + metronome.pulseMark + metronome.beatMarkerGap;

  it('spaces 12/8 at 360 x 800 one dot, label and compact gap apart', () => {
    for (const fontScale of [1, 2]) {
      expect(beatLinePitch('compact', dot, fontScale)).toBe(
        dot +
          cell +
          metronome.beatMarkerLineHeight * fontScale +
          metronome.beatDotLineGapCompact,
      );
    }
  });

  it('is the pitch the reserve stacks dot lines at', () => {
    for (const fontScale of [1, 2]) {
      const pitch = beatLinePitch('compact', dot, fontScale);
      expect(
        beatDotsHeight(TWELVE_EIGHT, { ...SMALL_COMPACT, fontScale }),
      ).toBeCloseTo(2 * pitch - metronome.beatDotLineGapCompact);
    }
  });
});
