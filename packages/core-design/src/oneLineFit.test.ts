import { describe, expect, it } from 'vitest';

import {
  fittedStyle,
  MAX_SETTLE_PASSES,
  measureOneLine,
  nextFitCandidate,
  oneLineFloor,
  resizeOneLine,
  startOneLine,
  type OneLineParams,
  type OneLineSettle,
} from './oneLineFit.ts';

const SIZE = 17;
const MIN = 15;
const ONE_PX = 0.25;
const PARAMS: OneLineParams = { size: SIZE, floor: 8.5, onePx: ONE_PX };

const step = {
  available: 140,
  size: SIZE,
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

  it('always lands at least a pixel below the last candidate', () => {
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

function measure(state: OneLineSettle, textWidth: number): OneLineSettle {
  return measureOneLine(
    state,
    {
      generation: state.generation,
      candidate: state.candidate,
      textWidth,
    },
    PARAMS,
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
    let measured = 1;
    while (!state.settled) {
      state = measure(state, 141);
      measured += 1;
    }
    expect(measured).toBe(1 + MAX_SETTLE_PASSES);
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
    const toPx = (sp: number) => (sp <= 12 ? 2 * sp : 24 + (sp - 12));
    const widthAt = (sp: number) => 5.5 * toPx(sp);
    const params = { ...PARAMS, onePx: 1 / (2.625 * 2) };
    let state = resizeOneLine(startOneLine('Metronome', SIZE), 140, params);
    while (!state.settled) {
      state = measureOneLine(
        state,
        {
          generation: state.generation,
          candidate: state.candidate,
          textWidth: widthAt(state.candidate),
        },
        params,
      );
    }
    expect(state.pass).toBeLessThan(MAX_SETTLE_PASSES);
    expect(widthAt(state.shown ?? 0)).toBeLessThanOrEqual(140);
    expect(state.shown).toBeGreaterThan(params.floor);
  });

  it('settles at the floor when even the floor overflows', () => {
    let state = measure(mounted, 1000);
    while (!state.settled) state = measure(state, 1000);
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
