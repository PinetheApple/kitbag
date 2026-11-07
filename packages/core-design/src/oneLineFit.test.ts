import { describe, expect, it } from 'vitest';

import {
  ELLIPSIS_FACE_RATIO,
  ellipsisPaintSize,
  fittedStyle,
  MAX_SETTLE_PASSES,
  measureOneLine,
  nextFitCandidate,
  oneLineFloor,
  resizeOneLine,
  startOneLine,
  titleFloorOverSubtitle,
  type OneLineParams,
  type OneLineSettle,
} from './oneLineFit.ts';

const SIZE = 17;
const MIN = 15;
const ONE_PX = 0.25;
const PARAMS: OneLineParams = { size: SIZE, floor: 8.5, onePx: ONE_PX };

const step = {
  available: 140,
  floor: 8.5,
  onePx: ONE_PX,
  previousPoint: undefined,
};

describe('nextFitCandidate', () => {
  it('is done at the candidate once it fits', () => {
    expect(
      nextFitCandidate({ ...step, textWidth: 120, candidate: SIZE, pass: 0 }),
    ).toEqual({ done: true, fontSize: SIZE });
  });

  it('first scales the design size in proportion to the overflow', () => {
    const next = nextFitCandidate({
      ...step,
      textWidth: 164,
      candidate: SIZE,
      pass: 0,
    });
    expect(next).toEqual({ done: false, candidate: (SIZE * 140) / 164 });
  });

  it('solves the line through the last two measurements after the first pass', () => {
    const next = nextFitCandidate({
      ...step,
      textWidth: 155,
      candidate: 15,
      pass: 1,
      previousPoint: { candidate: 17, textWidth: 170 },
    });
    expect(next).toEqual({ done: false, candidate: 13 - ONE_PX });
  });

  it('steps a pixel down when two measurements are inverted', () => {
    const next = nextFitCandidate({
      ...step,
      textWidth: 141,
      candidate: 15,
      pass: 1,
      previousPoint: { candidate: 17, textWidth: 130 },
    });
    expect(next).toEqual({ done: false, candidate: 15 - ONE_PX });
  });

  it('steps a pixel down when two measurements show no slope', () => {
    const next = nextFitCandidate({
      ...step,
      textWidth: 141,
      candidate: 15,
      pass: 1,
      previousPoint: { candidate: 15.5, textWidth: 141 },
    });
    expect(next).toEqual({ done: false, candidate: 15 - ONE_PX });
  });

  it('never proposes a candidate below the floor', () => {
    const next = nextFitCandidate({
      ...step,
      textWidth: 400,
      candidate: SIZE,
      pass: 0,
    });
    expect(next).toEqual({ done: false, candidate: 8.5 });
  });

  it('stops at the floor when the floor still overflows', () => {
    expect(
      nextFitCandidate({ ...step, textWidth: 200, candidate: 8.5, pass: 1 }),
    ).toEqual({ done: true, fontSize: 8.5 });
  });

  it('stops at the last candidate once the pass cap is reached', () => {
    expect(
      nextFitCandidate({
        ...step,
        textWidth: 141,
        candidate: 12,
        pass: MAX_SETTLE_PASSES,
      }),
    ).toEqual({ done: true, fontSize: 12 });
  });
});

describe('titleFloorOverSubtitle', () => {
  const ARTIST = 12.5;

  it('keeps a title with no line under it at its own floor', () => {
    expect(titleFloorOverSubtitle(8.5, undefined)).toBe(8.5);
  });

  it('never lets the floor sit below the line under the title', () => {
    expect(titleFloorOverSubtitle(oneLineFloor(2, SIZE, MIN), ARTIST)).toBe(
      ARTIST,
    );
  });

  it('leaves a floor already above that line alone', () => {
    expect(titleFloorOverSubtitle(oneLineFloor(1, SIZE, MIN), ARTIST)).toBe(
      MIN,
    );
  });
});

describe('ellipsisPaintSize', () => {
  const DEFAULT_FACE_EM = 0.669;
  const SPACE_GROTESK_MEDIUM_EM = 0.739;
  const INTER_REGULAR_EM = 0.864;
  const ARTIST = 12.5;

  it.each([SPACE_GROTESK_MEDIUM_EM, INTER_REGULAR_EM])(
    'reserves at least the width of a %f em ellipsis drawn at 2.0',
    (drawnEm) => {
      const drawn = ARTIST * 2;
      const reserved = ellipsisPaintSize(ARTIST, 2) * DEFAULT_FACE_EM;
      expect(reserved).toBeGreaterThanOrEqual(drawn * drawnEm);
    },
  );

  it('scales by the widest face over the default face', () => {
    expect(ELLIPSIS_FACE_RATIO).toBeCloseTo(INTER_REGULAR_EM / DEFAULT_FACE_EM);
    expect(ellipsisPaintSize(SIZE, 2)).toBe(SIZE * 2 * ELLIPSIS_FACE_RATIO);
  });
});

describe('oneLineFloor', () => {
  it('is the minimum size at or below the default font scale', () => {
    expect(oneLineFloor(1, SIZE, MIN)).toBe(MIN);
    expect(oneLineFloor(0.85, SIZE, MIN)).toBe(MIN);
  });

  it.each([1.1, 1.3, 2])(
    'never renders below the design size at font scale %d',
    (scale) => {
      expect(oneLineFloor(scale, SIZE, MIN) * scale).toBeCloseTo(SIZE);
    },
  );
});

describe('fittedStyle', () => {
  it('scales the tracking with the fitted size', () => {
    const role = {
      family: 'display',
      weight: 700,
      size: 20,
      tracking: 0.05,
    } as const;
    expect(fittedStyle(role, 10)).toEqual({ fontSize: 10, letterSpacing: 0.5 });
  });

  it('adds no letter spacing to an untracked role', () => {
    const role = { family: 'display', weight: 500, size: SIZE } as const;
    expect(fittedStyle(role, 12)).toEqual({ fontSize: 12 });
  });
});

function measure(
  state: OneLineSettle,
  textWidth: number,
  params = PARAMS,
): OneLineSettle {
  return measureOneLine(
    state,
    {
      generation: state.generation,
      candidate: state.candidate,
      textWidth,
    },
    params,
  );
}

describe('settling a one-line label', () => {
  const mounted = resizeOneLine(startOneLine('Metronome', SIZE), 140, PARAMS);

  it('starts hidden at the design size', () => {
    expect(mounted).toMatchObject({
      shown: undefined,
      candidate: SIZE,
      settled: false,
    });
  });

  it('shows the title once a candidate fits', () => {
    const fitted = measure(measure(mounted, 164), 139);
    expect(fitted.settled).toBe(true);
    expect(fitted.shown).toBeCloseTo((SIZE * 140) / 164);
  });

  it('measures at most the cap of extra passes, then shows the last candidate', () => {
    let state = measure(mounted, 164);
    for (let pass = 0; pass < MAX_SETTLE_PASSES; pass += 1) {
      expect(state.settled).toBe(false);
      state = measure(state, 141);
    }
    expect(state.settled).toBe(true);
    expect(state.shown).toBe(state.candidate);
  });

  it('keeps the previous size showing while new text settles', () => {
    const fitted = measure(mounted, 120);
    const renamed = startOneLine(
      'Blackbird (live at the Hollywood Bowl)',
      SIZE,
      fitted,
    );
    expect(renamed).toMatchObject({
      shown: SIZE,
      settled: false,
      candidate: SIZE,
    });
    expect(renamed.generation).toBeGreaterThan(fitted.generation);
  });

  it('starts again from the design size when the width changes', () => {
    const fitted = measure(measure(mounted, 164), 139);
    const resized = resizeOneLine(fitted, 200, PARAMS);
    expect(resized).toMatchObject({
      settled: false,
      candidate: SIZE,
      available: 200,
      previousPoint: undefined,
    });
    expect(resized.generation).toBeGreaterThan(fitted.generation);
  });

  it('settles on the resize when the measurement arrived first', () => {
    const measured = measure(startOneLine('Metronome', SIZE), 120);
    expect(measured.settled).toBe(false);
    expect(resizeOneLine(measured, 140, PARAMS)).toMatchObject({
      settled: true,
      shown: SIZE,
    });
  });

  it('settles on a fit above the floor when sp grows nonlinearly', () => {
    const density = 2.625;
    const fontScale = 2;
    const kneeSp = 12;
    const emWidths = 5.5;
    const toPx = (sp: number) =>
      Math.ceil(
        density *
          (sp <= kneeSp ? fontScale * sp : fontScale * kneeSp + (sp - kneeSp)),
      );
    const widthAt = (sp: number) => (emWidths * toPx(sp)) / density;
    const params = { ...PARAMS, onePx: 1 / (density * fontScale) };
    let state = resizeOneLine(startOneLine('Metronome', SIZE), 140, params);
    for (let i = 0; i <= MAX_SETTLE_PASSES && !state.settled; i += 1) {
      state = measure(state, widthAt(state.candidate), params);
    }
    expect(state.settled).toBe(true);
    expect(state.pass).toBeLessThan(MAX_SETTLE_PASSES);
    expect(widthAt(state.shown ?? 0)).toBeLessThanOrEqual(140);
    expect(state.shown).toBeGreaterThan(params.floor);
  });

  it('settles at the floor when even the floor overflows', () => {
    let state = mounted;
    for (let i = 0; i <= MAX_SETTLE_PASSES && !state.settled; i += 1) {
      state = measure(state, 1000);
    }
    expect(state.settled).toBe(true);
    expect(state.shown).toBe(PARAMS.floor);
  });

  it('ignores a measurement of an older candidate in the same generation', () => {
    const stepped = measure(mounted, 164);
    const older = {
      generation: stepped.generation,
      candidate: SIZE,
      textWidth: 10,
    };
    expect(measureOneLine(stepped, older, PARAMS)).toBe(stepped);
  });

  it('ignores a measurement taken before the last restart', () => {
    const stale = {
      generation: mounted.generation - 1,
      candidate: SIZE,
      textWidth: 10,
    };
    expect(measureOneLine(mounted, stale, PARAMS)).toBe(mounted);
  });

  it('stays settled when the text re-lays out at the same width', () => {
    const fitted = measure(mounted, 120);
    expect(measure(fitted, 120)).toBe(fitted);
  });

  it('starts again when the settled text re-lays out at a new width', () => {
    const fitted = measure(mounted, 120);
    const relaid = measure(fitted, 150);
    expect(relaid).toMatchObject({ settled: false, candidate: SIZE });
    expect(relaid.generation).toBeGreaterThan(fitted.generation);
  });
});
