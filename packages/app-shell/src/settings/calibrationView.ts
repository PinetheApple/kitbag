import type { OutputRoute } from '@kitbag/core-native';
import {
  analyseTaps,
  appliedOffset,
  CALIBRATION,
  formatOffsetMs,
  routeDetail,
  scatterHalfRangeMs,
  scatterX,
  type CalibrationNotice,
  type CalibrationPhase,
  type CalibrationSession,
} from '@kitbag/core-state';

const CALIBRATING_NOW = 'calibrating now';
const META_SEPARATOR = ' · ';
const REFUSED = 'Not enough steady taps; try again';
const USE_ANYWAY = 'Use anyway';

const NOTICE_TEXT: Readonly<Record<CalibrationNotice, string>> = {
  'route-changed': 'Output changed, so the run started again',
  'engine-restarted': 'Audio restarted, so the run started again',
};

const PHASE_TEXT: Partial<Readonly<Record<CalibrationPhase, string>>> = {
  busy: 'Stop the metronome to calibrate',
  failed: 'The click could not start; try again',
};

const DOT_TOP = 0.2;
const DOT_SPAN = 0.6;
const GOLDEN_FRACTION = 0.618034;

export type CalibrationResultView =
  | {
      readonly kind: 'measured';
      readonly badge: string;
      readonly useLabel: string;
    }
  | { readonly kind: 'message'; readonly text: string };

export interface ScatterDot {
  readonly x: number;
  readonly y: number;
}

export interface CalibrationView {
  readonly count: number;
  readonly progress: number;
  readonly dots: readonly ScatterDot[];
  readonly meanX: number | null;
  readonly axisMs: number;
  readonly result: CalibrationResultView | null;
  readonly canUse: boolean;
}

type ViewState = Pick<
  CalibrationSession,
  'phase' | 'route' | 'deviations' | 'outcome' | 'notice'
>;

export function routeMeta(route: OutputRoute): string {
  const detail = routeDetail(route);
  return detail === null
    ? CALIBRATING_NOW
    : [detail, CALIBRATING_NOW].join(META_SEPARATOR);
}

function lateness(offsetMs: number): string {
  if (offsetMs > 0) return 'LATE';
  if (offsetMs < 0) return 'EARLY';
  return 'ON TIME';
}

function dotY(index: number): number {
  return DOT_TOP + ((index * GOLDEN_FRACTION) % 1) * DOT_SPAN;
}

function resultOf(state: ViewState): CalibrationResultView | null {
  const phaseText = PHASE_TEXT[state.phase];
  if (phaseText !== undefined) return { kind: 'message', text: phaseText };
  if (state.notice !== null) {
    return { kind: 'message', text: NOTICE_TEXT[state.notice] };
  }
  const outcome = analyseTaps(state.deviations);
  if (outcome.kind === 'refused') {
    return state.phase === 'done' ? { kind: 'message', text: REFUSED } : null;
  }
  const meanMs = Math.round(outcome.meanMs);
  const spread = `±${String(Math.round(outcome.sdMs))} ms`;
  return {
    kind: 'measured',
    badge: `${formatOffsetMs(meanMs)} ${lateness(meanMs)} · ${spread}`,
    useLabel: outcome.steady
      ? `Use ${formatOffsetMs(appliedOffset(outcome.meanMs).offsetMs)}`
      : USE_ANYWAY,
  };
}

export function calibrationView(state: ViewState): CalibrationView {
  const live = analyseTaps(state.deviations);
  const measured = live.kind === 'measured' ? live : null;
  const axisMs = scatterHalfRangeMs(measured?.meanMs ?? 0, measured?.sdMs ?? 0);
  return {
    count: state.deviations.length,
    progress: state.deviations.length / CALIBRATION.taps,
    dots: state.deviations.map((deviation, index) => ({
      x: scatterX(deviation, axisMs),
      y: dotY(index),
    })),
    meanX: measured === null ? null : scatterX(measured.meanMs, axisMs),
    axisMs,
    result: resultOf(state),
    canUse:
      state.phase === 'done' &&
      state.outcome?.kind === 'measured' &&
      state.route?.certain === true,
  };
}
