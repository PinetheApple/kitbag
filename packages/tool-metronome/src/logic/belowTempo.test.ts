import { metronome, space } from '@kitbag/core-design';
import { KB_MAX_BEATS } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { belowTempoReserve, DOT_METRICS } from './belowTempo.ts';
import { beatDotSize, layoutBeatLeds, MAX_DOTS_PER_LINE } from './ledLayout.ts';

const SMALL_PHONE_DOTS_WIDTH = 360 - space.screenInset * 2;
const LARGE_PHONE_DOTS_WIDTH = 411 - space.screenInset * 2;
const FONT_SCALES = [1, 1.3] as const;
const BEAT_COUNTS = Array.from({ length: KB_MAX_BEATS }, (_u, i) => i + 1);

interface Rendered {
  readonly beatCount: number;
  readonly poly: boolean;
  readonly labelAbove: boolean;
  readonly fontScale: number;
  readonly width: number;
  readonly gap: number;
}

// Stacks the boxes BeatDots, PolyDots and StatusStack draw, token by token.
function renderedBelowTempo(shape: Rendered): number {
  const lines = layoutBeatLeds(shape.beatCount, MAX_DOTS_PER_LINE);
  const dot = beatDotSize(lines, shape.width, DOT_METRICS);
  const marker = Math.max(
    metronome.beatMarkerLineHeight,
    metronome.beatMarkerLineHeight * shape.fontScale,
  );
  const beat =
    dot +
    metronome.beatMarkerGap +
    metronome.pulseMark +
    metronome.beatMarkerGap +
    marker;
  let dots =
    lines.length * beat + (lines.length - 1) * metronome.beatDotLineGap;
  if (shape.poly) {
    dots += metronome.beatDotLineGap + metronome.polyDot;
    if (shape.labelAbove) {
      dots +=
        metronome.beatMarkerLineHeight * shape.fontScale +
        metronome.beatMarkerGap;
    }
  }
  const status = metronome.statusRow * 2 + metronome.statusRowGap;
  return dots + shape.gap + status;
}

const ROOMS = [
  { width: SMALL_PHONE_DOTS_WIDTH, gap: metronome.bodyGapCompact },
  { width: LARGE_PHONE_DOTS_WIDTH, gap: space.sectionGap },
] as const;

describe('belowTempoReserve', () => {
  it.each(ROOMS)(
    'holds every meter, poly and poly-label place at $width dp',
    ({ width, gap }) => {
      for (const fontScale of FONT_SCALES) {
        const reserve = belowTempoReserve({ width, gap, fontScale });
        for (const beatCount of BEAT_COUNTS) {
          for (const poly of [false, true]) {
            for (const labelAbove of [false, true]) {
              const rendered = renderedBelowTempo({
                beatCount,
                poly,
                labelAbove,
                fontScale,
                width,
                gap,
              });
              expect(rendered).toBeLessThanOrEqual(reserve);
            }
          }
        }
      }
    },
  );

  it.each(ROOMS)(
    'wastes no room past the tallest song at $width dp',
    ({ width, gap }) => {
      for (const fontScale of FONT_SCALES) {
        const tallest = Math.max(
          ...BEAT_COUNTS.map((beatCount) =>
            renderedBelowTempo({
              beatCount,
              poly: true,
              labelAbove: true,
              fontScale,
              width,
              gap,
            }),
          ),
        );
        expect(belowTempoReserve({ width, gap, fontScale })).toBe(tallest);
      }
    },
  );
});
