import {
  CALIBRATION,
  MINUS,
  type CalibrationSession,
} from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  calibrationView,
  routeMeta,
  SCATTER,
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

  it('pins a tap off the axis to its edge', () => {
    expect(scatterX(200, 50)).toBe(1);
    expect(scatterX(-200, 50)).toBe(0);
  });
});
