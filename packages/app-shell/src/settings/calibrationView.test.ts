import {
  bodyLineHeight,
  calibration,
  calibrationText,
} from '@kitbag/core-design';
import { KB_LATENCY_OFFSET_MS_BOUNDS } from '@kitbag/core-native';
import {
  BEAT_MS,
  CALIBRATION,
  MINUS,
  type CalibrationSession,
} from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  calibrationView,
  routeMeta,
  SCATTER,
  SCATTER_DOT_BAND,
  scatterHalfRangeMs,
  scatterX,
} from './calibrationView.ts';

type ViewState = Pick<
  CalibrationSession,
  'phase' | 'route' | 'deviations' | 'outcome' | 'notice'
>;

const HEADPHONES = {
  id: 'bt',
  name: 'WH-1000XM4',
  kind: 'bluetooth',
  certain: true,
} as const;

const state = (patch: Partial<ViewState>): ViewState => ({
  phase: 'running',
  route: HEADPHONES,
  deviations: [],
  outcome: null,
  notice: null,
  ...patch,
});

const alternating = (
  centre: number,
  half: number,
  count: number = CALIBRATION.taps,
) =>
  Array.from(
    { length: count },
    (_, i) => centre + (i % 2 === 0 ? -half : half),
  );

const CENTRE_X = 0.5;
const WRAP_CENTRE_MS = 265;
const WRAP_HALF_MS = 40;
const acrossTheWrap = alternating(WRAP_CENTRE_MS, WRAP_HALF_MS).map((d) =>
  d > BEAT_MS / 2 ? d - BEAT_MS : d,
);

const WRAP_LIMIT_MS = KB_LATENCY_OFFSET_MS_BOUNDS.max;
const WRAP_LIMIT_HALF_MS = 10;
const atTheLimit = alternating(WRAP_LIMIT_MS, WRAP_LIMIT_HALF_MS).map((d) =>
  d > BEAT_MS / 2 ? d - BEAT_MS : d,
);

describe('calibration view', () => {
  it('counts taps out of 16', () => {
    const view = calibrationView(state({ deviations: alternating(12, 3, 12) }));
    expect(view.count).toBe(12);
    expect(view.progress).toBe(12 / CALIBRATION.taps);
  });

  it('shows the running result once enough taps are in, without letting it be used', () => {
    const view = calibrationView(state({ deviations: alternating(12, 3, 12) }));
    expect(view.result).toEqual({
      kind: 'measured',
      badge: '+12 ms LATE · ±3 ms',
      useLabel: 'Use +12 ms',
    });
    expect(view.canUse).toBe(false);
  });

  it('can be used once the run is done', () => {
    const deviations = alternating(12, 3);
    const view = calibrationView(
      state({
        phase: 'done',
        deviations,
        outcome: {
          kind: 'measured',
          meanMs: 12,
          sdMs: 3,
          usable: 16,
          steady: true,
        },
      }),
    );
    expect(view.canUse).toBe(true);
  });

  it('says early for a negative offset', () => {
    const view = calibrationView(state({ deviations: alternating(-8, 2, 10) }));
    expect(view.result).toMatchObject({
      badge: `${MINUS}8 ms EARLY · ±2 ms`,
      useLabel: `Use ${MINUS}8 ms`,
    });
  });

  it('asks the user to use anyway when the taps spread wide', () => {
    const view = calibrationView(
      state({ deviations: alternating(12, 40, 10) }),
    );
    expect(view.result).toMatchObject({ useLabel: 'Use anyway' });
  });

  it('refuses with no number when the latency is at the limit', () => {
    const view = calibrationView(
      state({
        phase: 'done',
        deviations: alternating(0, 290),
        outcome: { kind: 'refused', reason: 'at-limit', usable: 16 },
      }),
    );
    expect(view.result).toEqual({
      kind: 'message',
      text: 'Latency is at the limit Kitbag can correct',
    });
    expect(view.canUse).toBe(false);
    expect(view.showUse).toBe(false);
  });

  it('cannot be used against an uncertain route', () => {
    const view = calibrationView(
      state({
        phase: 'done',
        route: { ...HEADPHONES, certain: false },
        deviations: alternating(12, 3),
        outcome: {
          kind: 'measured',
          meanMs: 12,
          sdMs: 3,
          usable: 16,
          steady: true,
        },
      }),
    );
    expect(view.canUse).toBe(false);
  });

  it('says why the run started again', () => {
    expect(calibrationView(state({ notice: 'route-changed' })).result).toEqual({
      kind: 'message',
      text: 'Output changed, so the run started again',
    });
    expect(
      calibrationView(state({ notice: 'engine-restarted' })).result,
    ).toEqual({
      kind: 'message',
      text: 'Audio restarted, so the run started again',
    });
  });

  it('explains a click that could not start', () => {
    expect(calibrationView(state({ phase: 'busy' })).result).toEqual({
      kind: 'message',
      text: 'Stop the metronome to calibrate',
    });
  });

  it('draws one dot per tap in tap order, zero centred', () => {
    const view = calibrationView(state({ deviations: [0, 25, -50] }));
    expect(view.dots.map((d) => d.x)).toEqual([0.5, 0.75, 0]);
    expect(view.axisMs).toBe(SCATTER.minHalfRangeMs);
  });

  it('offers use anyway for messy taps near the limit', () => {
    const view = calibrationView(
      state({ phase: 'done', deviations: acrossTheWrap }),
    );
    expect(view.result).toMatchObject({
      kind: 'measured',
      useLabel: 'Use anyway',
    });
    expect(view.showUse).toBe(true);
  });

  it('draws a tap past the wrap on the mean’s side of the axis', () => {
    const view = calibrationView(state({ deviations: acrossTheWrap }));
    const lateMs = WRAP_CENTRE_MS + WRAP_HALF_MS;
    expect(view.dots[1]?.x).toBeCloseTo(scatterX(lateMs, view.axisMs));
    expect(view.dots.every((d) => d.x > CENTRE_X)).toBe(true);
  });

  it('sizes the axis to a refused run’s unwrapped taps so no dot pins to an edge', () => {
    const view = calibrationView(
      state({
        phase: 'done',
        deviations: atTheLimit,
        outcome: { kind: 'refused', reason: 'at-limit', usable: 16 },
      }),
    );
    expect(view.result).toMatchObject({ kind: 'message' });
    expect(view.axisMs).toBeGreaterThanOrEqual(
      WRAP_LIMIT_MS + WRAP_LIMIT_HALF_MS,
    );
    expect(view.dots.every((d) => d.x > CENTRE_X && d.x < 1)).toBe(true);
  });

  it('places the mean line on the usable mean', () => {
    const view = calibrationView(state({ deviations: alternating(25, 2, 10) }));
    expect(view.meanX).toBeCloseTo(0.75);
  });
});

describe('route meta', () => {
  it('names the kind before saying it is calibrating now', () => {
    expect(routeMeta(HEADPHONES)).toBe('Bluetooth · calibrating now');
    expect(
      routeMeta({ id: 'speaker', name: '', kind: 'speaker', certain: true }),
    ).toBe('calibrating now');
  });
});

describe('calibration messages', () => {
  it('says why Use is off when the output stayed unknown', () => {
    const view = calibrationView(
      state({
        phase: 'done',
        route: { ...HEADPHONES, certain: false },
        deviations: alternating(12, 3),
        outcome: {
          kind: 'measured',
          meanMs: 12,
          sdMs: 3,
          usable: 16,
          steady: true,
        },
      }),
    );
    expect(view.result).toEqual({
      kind: 'message',
      text: 'Can’t tell which output is in use. Try again.',
    });
    expect(view.showUse).toBe(true);
  });

  it('says the click stopped under the run', () => {
    expect(calibrationView(state({ phase: 'stopped' })).result).toEqual({
      kind: 'message',
      text: 'The click stopped. Start over to calibrate.',
    });
  });

  it('refuses with no number when too few taps were steady', () => {
    const view = calibrationView(
      state({
        phase: 'done',
        deviations: alternating(12, 3, CALIBRATION.minUsableTaps - 1),
        outcome: { kind: 'refused', reason: 'too-few', usable: 7 },
      }),
    );
    expect(view.result).toEqual({
      kind: 'message',
      text: 'Not enough steady taps; try again',
    });
  });

  it('says the output could not be read', () => {
    expect(calibrationView(state({ phase: 'route-failed' })).result).toEqual({
      kind: 'message',
      text: 'Couldn’t read the audio output. Try again.',
    });
  });

  it('shows the failure when the click could not start', () => {
    expect(calibrationView(state({ phase: 'failed' })).result).toEqual({
      kind: 'message',
      text: 'The click could not start; try again',
    });
  });
});

describe('scatter', () => {
  it('spans at least ±50 ms', () => {
    expect(scatterHalfRangeMs(0, 0)).toBe(SCATTER.minHalfRangeMs);
    expect(scatterHalfRangeMs(12, 3)).toBe(SCATTER.minHalfRangeMs);
  });

  it('widens to keep mean ±3 SD on screen', () => {
    expect(scatterHalfRangeMs(40, 10)).toBe(70);
    expect(scatterHalfRangeMs(-40, 10)).toBe(70);
  });

  it('keeps every dot above the axis label row', () => {
    const labelRowTop =
      calibration.scatterHeight -
      calibration.axisBottom -
      calibrationText.scatterAxis.size * bodyLineHeight;
    const bandHeight =
      calibration.scatterHeight -
      SCATTER_DOT_BAND.top -
      SCATTER_DOT_BAND.bottom;
    const lowestDotEdge =
      SCATTER_DOT_BAND.top +
      bandHeight * (SCATTER.dotTop + SCATTER.dotSpan) +
      calibration.dot / 2;
    expect(lowestDotEdge).toBeLessThanOrEqual(labelRowTop);
  });

  it('pins a tap off the axis to its edge', () => {
    expect(scatterX(200, 50)).toBe(1);
    expect(scatterX(-200, 50)).toBe(0);
  });
});
