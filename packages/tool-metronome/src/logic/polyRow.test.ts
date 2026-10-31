import { metronome, space } from '@kitbag/core-design';
import { KB_POLY_AGAINST_BAR, KB_POLY_PHASE_NONE } from '@kitbag/core-native';
import { effectivePolyAgainst } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import { beatDotMetrics, DOT_METRICS } from './belowTempo.ts';
import {
  beatDotSize,
  layoutBeatLeds,
  MAX_DOTS_PER_LINE,
  widestLineWidth,
} from './ledLayout.ts';
import {
  NO_CYCLE,
  polyAgainstLabel,
  polyBar,
  polyBarTable,
  polyCycleOffset,
  polyDotSize,
  polyLabelPlace,
  polyLastDotRight,
  polyRatioLabel,
  polyStripCaption,
  polySpanInArea,
  polySpanPlace,
  polyX,
  soundingCycle,
  type PolyRatio,
} from './polyRow.ts';

const ROW = { lineWidth: 4 * 56 + 3 * 12, dotSize: 56, dotGap: 12 };
const POLY_FILE_DOT = 22;
const EXACT_PLACES = 9;
const DESIGN_PLACES = 1;
const POLY_DOT_RADIUS = POLY_FILE_DOT / 2;
const roundTo = (value: number, places: number) => {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
};
const exact = (value: number) => roundTo(value, EXACT_PLACES);

function pulsesOf(ratio: PolyRatio, offset: number) {
  return polyBar(ratio, offset).pulses.map(({ beat, slot, cycle }) => [
    exact(beat),
    slot,
    cycle,
  ]);
}

function spansOf(ratio: PolyRatio, offset: number) {
  return polyBar(ratio, offset).spans.map(({ cycle, start, end }) => [
    cycle,
    start,
    end,
  ]);
}

const offsetAtBar = (bar: number, ratio: PolyRatio) =>
  polyCycleOffset(
    ((bar * ratio.beatsPerBar) % ratio.against) / ratio.against,
    ratio.against,
  );

describe('3:2 in 4/4', () => {
  const ratio = { polyBeats: 3, against: 2, beatsPerBar: 4 };

  it('draws the cycle twice, a pulse every two thirds of a beat', () => {
    expect(pulsesOf(ratio, 0)).toEqual([
      [0, 0, 0],
      [exact(2 / 3), 1, 0],
      [exact(4 / 3), 2, 0],
      [2, 0, 1],
      [exact(8 / 3), 1, 1],
      [exact(10 / 3), 2, 1],
    ]);
  });

  it('brackets each cycle over exactly two beats', () => {
    expect(spansOf(ratio, 0)).toEqual([
      [0, 0, 2],
      [1, 2, 4],
    ]);
  });

  it('places pulses and brackets where the design draws them', () => {
    const lefts = polyBar(ratio, 0).pulses.map((pulse) =>
      roundTo(
        polyX(pulse.beat, ratio.beatsPerBar, ROW) - POLY_DOT_RADIUS,
        DESIGN_PLACES,
      ),
    );
    expect(lefts).toEqual([17, 62.3, 107.7, 153, 198.3, 243.7]);
    expect(
      polyBar(ratio, 0).spans.map((span) =>
        polySpanPlace(span, ratio.beatsPerBar, ROW),
      ),
    ).toEqual([
      { left: 28, width: 136 },
      { left: 164, width: 136 },
    ]);
  });

  it('lights the cycle the main beat is in', () => {
    expect(soundingCycle(1, 0, ratio.against)).toBe(0);
    expect(soundingCycle(2, 0, ratio.against)).toBe(1);
  });
});

describe('5:3 in 4/4 over bars 1 to 4', () => {
  const ratio = { polyBeats: 5, against: 3, beatsPerBar: 4 };

  it('rebuilds the cycle offset from the downbeat phase each bar', () => {
    expect([0, 1, 2, 3].map((bar) => offsetAtBar(bar, ratio))).toEqual([
      0, 1, 2, 0,
    ]);
  });

  it('bar 1: a cycle spans three beats and crosses the barline', () => {
    expect(pulsesOf(ratio, 0)).toEqual([
      [0, 0, 0],
      [0.6, 1, 0],
      [1.2, 2, 0],
      [1.8, 3, 0],
      [2.4, 4, 0],
      [3, 0, 1],
      [3.6, 1, 1],
    ]);
    expect(spansOf(ratio, 0)).toEqual([
      [0, 0, 3],
      [1, 3, 4],
    ]);
    expect(
      polySpanPlace({ cycle: 1, start: 3, end: 4 }, ratio.beatsPerBar, ROW),
    ).toEqual({ left: 232, width: 68 });
  });

  it('bar 2: the carried cycle ends on beat 3 and is clipped at the barline', () => {
    expect(pulsesOf(ratio, 1)).toEqual([
      [0.2, 2, 0],
      [0.8, 3, 0],
      [1.4, 4, 0],
      [2, 0, 1],
      [2.6, 1, 1],
      [3.2, 2, 1],
      [3.8, 3, 1],
    ]);
    expect(spansOf(ratio, 1)).toEqual([
      [0, 0, 2],
      [1, 2, 4],
    ]);
    expect(soundingCycle(1, 1, ratio.against)).toBe(0);
    expect(soundingCycle(2, 1, ratio.against)).toBe(1);
  });

  it('bar 3: one pulse is left of the carried cycle', () => {
    expect(pulsesOf(ratio, 2)).toEqual([
      [0.4, 4, 0],
      [1, 0, 1],
      [1.6, 1, 1],
      [2.2, 2, 1],
      [2.8, 3, 1],
      [3.4, 4, 1],
    ]);
    expect(spansOf(ratio, 2)).toEqual([
      [0, 0, 1],
      [1, 1, 4],
    ]);
    expect(soundingCycle(1, 2, ratio.against)).toBe(1);
  });

  it('bar 4 draws bar 1 again', () => {
    expect(pulsesOf(ratio, offsetAtBar(3, ratio))).toEqual(pulsesOf(ratio, 0));
  });

  it('tables one bar per cycle offset', () => {
    expect(polyBarTable(ratio)).toEqual(
      [0, 1, 2].map((o) => polyBar(ratio, o)),
    );
  });
});

describe('3:4, against the bar', () => {
  const ratio = { polyBeats: 3, against: 4, beatsPerBar: 4 };

  it('draws one cycle over the bar', () => {
    expect(pulsesOf(ratio, 0)).toEqual([
      [0, 0, 0],
      [exact(4 / 3), 1, 0],
      [exact(8 / 3), 2, 0],
    ]);
    expect(
      polyBar(ratio, 0).spans.map((span) =>
        polySpanPlace(span, ratio.beatsPerBar, ROW),
      ),
    ).toEqual([{ left: 28, width: 272 }]);
  });
});

describe('3:6 in 4/4', () => {
  it('leaves a pulse on the barline to the next bar', () => {
    const ratio = { polyBeats: 3, against: 6, beatsPerBar: 4 };
    expect(pulsesOf(ratio, 0)).toEqual([
      [0, 0, 0],
      [2, 1, 0],
    ]);
  });
});

describe('7/8', () => {
  it('3 against the bar spans all seven beats', () => {
    const ratio = { polyBeats: 3, against: 7, beatsPerBar: 7 };
    expect(pulsesOf(ratio, 0)).toEqual([
      [0, 0, 0],
      [exact(7 / 3), 1, 0],
      [exact(14 / 3), 2, 0],
    ]);
    expect(spansOf(ratio, 0)).toEqual([[0, 0, 7]]);
  });

  it('3:2 carries the odd beat into the next bar', () => {
    const ratio = { polyBeats: 3, against: 2, beatsPerBar: 7 };
    expect(offsetAtBar(1, ratio)).toBe(1);
    expect(spansOf(ratio, 0)).toEqual([
      [0, 0, 2],
      [1, 2, 4],
      [2, 4, 6],
      [3, 6, 7],
    ]);
    expect(spansOf(ratio, 1)).toEqual([
      [0, 0, 1],
      [1, 1, 3],
      [2, 3, 5],
      [3, 5, 7],
    ]);
    expect(pulsesOf(ratio, 1)[0]).toEqual([exact(1 / 3), 2, 0]);
  });
});

describe('bar mode across a meter change', () => {
  const ratioIn = (against: number, beatsPerBar: number): PolyRatio => ({
    polyBeats: 3,
    against: effectivePolyAgainst(against, beatsPerBar),
    beatsPerBar,
  });

  it('follows the new bar', () => {
    expect(spansOf(ratioIn(KB_POLY_AGAINST_BAR, 4), 0)).toEqual([[0, 0, 4]]);
    expect(spansOf(ratioIn(KB_POLY_AGAINST_BAR, 3), 0)).toEqual([[0, 0, 3]]);
    expect(polyRatioLabel(ratioIn(KB_POLY_AGAINST_BAR, 3))).toBe('3:3');
  });

  it('keeps an explicit count over the new bar', () => {
    expect(spansOf(ratioIn(2, 3), 0)).toEqual([
      [0, 0, 2],
      [1, 2, 3],
    ]);
    expect(polyRatioLabel(ratioIn(2, 3))).toBe('3:2');
  });
});

describe('cycle offset', () => {
  it('reads no cycle as the bar starting one', () => {
    expect(polyCycleOffset(KB_POLY_PHASE_NONE, 3)).toBe(0);
  });

  it('wraps a phase that rounds up to a whole cycle', () => {
    expect(polyCycleOffset(0.9999, 3)).toBe(0);
  });

  it('lights no cycle while stopped', () => {
    expect(soundingCycle(-1, 2, 3)).toBe(NO_CYCLE);
  });
});

describe('poly dot size', () => {
  it('keeps the full dot while pulses have room', () => {
    expect(
      polyDotSize(
        { polyBeats: 3, against: 2, beatsPerBar: 4 },
        ROW,
        POLY_FILE_DOT,
      ),
    ).toBe(POLY_FILE_DOT);
  });

  it('shrinks only when pulses would touch', () => {
    expect(
      polyDotSize(
        { polyBeats: 16, against: 1, beatsPerBar: 4 },
        ROW,
        POLY_FILE_DOT,
      ),
    ).toBeCloseTo(272 / 64);
  });
});

describe('against value', () => {
  it('reads the sentinel as the bar', () => {
    expect(polyAgainstLabel(KB_POLY_AGAINST_BAR, 4)).toEqual({
      value: '4',
      suffix: 'bar',
      spoken: '4 beats, the bar',
    });
  });

  it('reads an explicit count as a bare number', () => {
    expect(polyAgainstLabel(2, 4)).toEqual({
      value: '2',
      suffix: undefined,
      spoken: '2 beats',
    });
  });
});

describe('one-cycle strip caption', () => {
  it('reads an explicit cycle as part of the bar', () => {
    expect(polyStripCaption(3, 2, 4)).toEqual({
      cycle: 'one cycle: 3 poly over 2 main',
      span: '2 of 4 beats',
    });
  });

  it('reads the sentinel as the bar', () => {
    expect(polyStripCaption(3, KB_POLY_AGAINST_BAR, 4)).toEqual({
      cycle: 'one cycle: 3 poly over 4 main',
      span: 'the bar',
    });
  });
});

describe('poly label', () => {
  const ROOM = {
    labelWidth: 20,
    labelHeight: 15,
    rowHeight: 22,
    labelGap: 8,
    sideRoom: 34,
    screenInset: 16,
    afterLastDot: 0,
  };

  it('follows the last poly dot when the room after it holds the label', () => {
    expect(polyLabelPlace(ROOM)).toBe('right');
    expect(
      polyLabelPlace({
        ...ROOM,
        labelWidth: 27,
        sideRoom: 0,
        afterLastDot: 69,
      }),
    ).toBe('right');
  });

  it('sits left of the row when only the left margin holds it', () => {
    expect(
      polyLabelPlace({
        ...ROOM,
        labelWidth: 40,
        sideRoom: 34,
        afterLastDot: -34,
      }),
    ).toBe('left');
  });

  it('moves above the row when large text is taller than the dots', () => {
    expect(polyLabelPlace({ ...ROOM, labelHeight: 30 })).toBe('above');
  });

  it('moves above the row when neither side holds it', () => {
    expect(
      polyLabelPlace({
        ...ROOM,
        labelWidth: 52,
        sideRoom: 0,
        afterLastDot: 20,
      }),
    ).toBe('above');
  });

  it('reads poly beats against M', () => {
    expect(polyRatioLabel({ polyBeats: 5, against: 3, beatsPerBar: 4 })).toBe(
      '5:3',
    );
  });
});

describe('cycle bracket inside the dots area', () => {
  const SIXTEEN = 16;
  const wholeBar = { cycle: 0, start: 0, end: SIXTEEN };

  function rowAt(screenWidth: number) {
    const areaWidth = screenWidth - space.screenInset * 2;
    const lines = layoutBeatLeds(SIXTEEN, MAX_DOTS_PER_LINE);
    const metrics = beatDotMetrics('compact', lines);
    const dotSize = beatDotSize(lines, areaWidth, metrics);
    const lineWidth = widestLineWidth(lines, dotSize, metrics);
    return {
      areaWidth,
      row: { lineWidth, dotSize, dotGap: DOT_METRICS.dotGap },
    };
  }

  it('keeps a 16/16 bracket and its end tick inside the inset at 360 wide', () => {
    const { areaWidth, row } = rowAt(360);
    const rowLeftInArea = (areaWidth - row.lineWidth) / 2;
    const place = polySpanInArea(wholeBar, SIXTEEN, row, areaWidth);
    expect(rowLeftInArea + place.left + place.width).toBeLessThanOrEqual(
      areaWidth,
    );
  });

  it('leaves the 411 wide bracket where the bar line puts it', () => {
    const { areaWidth, row } = rowAt(411);
    expect(polySpanInArea(wholeBar, SIXTEEN, row, areaWidth)).toEqual(
      polySpanPlace(wholeBar, SIXTEEN, row),
    );
  });
});

describe('poly label beside 16/16 at 411 wide', () => {
  const R2_LABEL_BOX = 40;
  const areaWidth = 411 - space.screenInset * 2;
  const lines = layoutBeatLeds(16, MAX_DOTS_PER_LINE);

  for (const density of ['compact', 'roomy'] as const) {
    const metrics = beatDotMetrics(density, lines);
    const dotSize = beatDotSize(lines, areaWidth, metrics);
    const lineWidth = widestLineWidth(lines, dotSize, metrics);
    const row = { lineWidth, dotSize, dotGap: DOT_METRICS.dotGap };

    for (const polyBeats of [3, 5]) {
      it(`puts ${String(polyBeats)}:16 right of the row, ${density}`, () => {
        const ratio = { polyBeats, against: 16, beatsPerBar: 16 };
        const size = polyDotSize(ratio, row, metronome.polyDot);
        expect(
          polyLabelPlace({
            labelWidth: R2_LABEL_BOX,
            labelHeight: metronome.beatMarkerLineHeight,
            rowHeight: metronome.polyDot,
            labelGap: metronome.polyLabelGap,
            sideRoom: (areaWidth - lineWidth) / 2,
            screenInset: space.screenInset,
            afterLastDot: lineWidth - polyLastDotRight(ratio, row, size),
          }),
        ).toBe('right');
      });
    }
  }
});
