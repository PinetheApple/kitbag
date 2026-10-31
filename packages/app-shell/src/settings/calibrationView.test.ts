import {
  CALIBRATION,
  MINUS,
  type CalibrationSession,
} from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import { calibrationView, routeMeta } from './calibrationView.ts';

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

  it('refuses with no number after a run without 8 usable taps', () => {
    const view = calibrationView(
      state({
        phase: 'done',
        deviations: alternating(400, 3),
        outcome: { kind: 'refused', usable: 0 },
      }),
    );
    expect(view.result).toEqual({
      kind: 'message',
      text: 'Not enough steady taps; try again',
    });
    expect(view.canUse).toBe(false);
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
    expect(view.axisMs).toBe(CALIBRATION.minScatterHalfRangeMs);
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
