import { metronome, space } from '@kitbag/core-design';
import { KB_MAX_BEATS } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import {
  beatDotsHeight,
  beatLinePitch,
  belowTempoReserve,
  DOT_METRICS,
  statusProgressReserve,
  statusRowHeight,
  statusRowPitch,
  statusStackHeight,
  statusStackPinned,
  statusTextLines,
  tallestBelowTempo,
  type BelowTempoRoom,
} from './belowTempo.ts';
import { beatDotSize, layoutBeatLeds, MAX_DOTS_PER_LINE } from './ledLayout.ts';

const SMALL_PHONE_DOTS_WIDTH = 360 - space.screenInset * 2;
const LARGE_PHONE_DOTS_WIDTH = 411 - space.screenInset * 2;
const DEFAULT_FONT_SCALE = 1;
const FONT_SCALES = [DEFAULT_FONT_SCALE, 1.3, 2] as const;
const BEAT_COUNTS = Array.from({ length: KB_MAX_BEATS }, (_u, i) => i + 1);

// Where the dots start and where the body ends above the transport, at fontScale
// 1.0. Emulator-measured on 8663a62, before #243.
const MEASURED_LARGE = { dotsTop: 436.4, bodyBottom: 813.8 } as const;

const APPROVED_MOCKUP_SMALL = { dotsTop: 418, bodyBottom: 658 } as const;

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
// roomy screen, stopped and running; grown text pins StatusStack outside the body.
function renderedRoomy(shape: Rendered): number {
  const lines = layoutBeatLeds(shape.beatCount, MAX_DOTS_PER_LINE);
  const dot = beatDotSize(lines, LARGE_PHONE_DOTS_WIDTH, DOT_METRICS);
  const scale = Math.max(1, shape.fontScale);
  const label = metronome.beatMarkerLineHeight * scale;
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
  const legend = metronome.legendTop + metronome.legendRow * scale;
  if (shape.fontScale > DEFAULT_FONT_SCALE) return dots + legend;
  const row = metronome.statusRow;
  const stopped = legend + row;
  const running = row * 2 + metronome.statusRowGap;
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
    const budget = MEASURED_LARGE.bodyBottom - MEASURED_LARGE.dotsTop;
    expect(belowTempoReserve(LARGE_ROOMY)).toBeLessThanOrEqual(budget);
  });

  it('fits every song with its poly label beside the dots at 360 x 800', () => {
    const budget =
      APPROVED_MOCKUP_SMALL.bodyBottom - APPROVED_MOCKUP_SMALL.dotsTop;
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

describe('the status stack', () => {
  it('keeps the drawn row height at the default text size', () => {
    expect(statusRowHeight(1)).toBe(metronome.statusRow);
    expect(statusRowHeight(0.85)).toBe(metronome.statusRow);
  });

  it('grows each row with the text so a wrapped second line fits', () => {
    const grown = metronome.statusRow * 2 + metronome.statusProgress;
    expect(statusRowHeight(2)).toBe(grown);
    expect(statusRowPitch(2)).toBe(grown + metronome.statusRowGap);
  });

  it('keeps grown text clear of the progress bar along the row foot', () => {
    expect(statusProgressReserve(1)).toBe(0);
    expect(statusProgressReserve(2)).toBe(metronome.statusProgress);
  });

  it('stacks two grown rows while running and one while stopped', () => {
    for (const fontScale of FONT_SCALES) {
      const row = statusRowHeight(fontScale);
      expect(statusStackHeight(false, fontScale)).toBe(row);
      expect(statusStackHeight(true, fontScale)).toBe(
        statusRowPitch(fontScale) + row,
      );
    }
  });

  it('pins above the transport only once the text grows', () => {
    expect(statusStackPinned(0.85)).toBe(false);
    expect(statusStackPinned(1)).toBe(false);
    expect(statusStackPinned(1.3)).toBe(true);
    expect(statusStackPinned(2)).toBe(true);
  });

  it('lets status text take a second line once the text grows', () => {
    expect(statusTextLines(1)).toBe(1);
    expect(statusTextLines(1.3)).toBe(2);
    expect(statusTextLines(2)).toBe(2);
  });
});
