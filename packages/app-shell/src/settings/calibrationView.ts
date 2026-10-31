import type { OutputRoute } from '@kitbag/core-native';
import {
  analyseTaps,
  canUseOutcome,
  CALIBRATION,
  formatOffsetMs,
  routeDetail,
  storedOffsetMs,
  type CalibrationNotice,
  type CalibrationOutcome,
  type CalibrationPhase,
  type CalibrationSession,
  type RefusalReason,
} from '@kitbag/core-state';

const CALIBRATING_NOW = 'calibrating now';
const META_SEPARATOR = ' · ';
const REFUSED: Readonly<Record<RefusalReason, string>> = {
  'too-few': 'Not enough steady taps; try again',
  'at-limit': 'Latency is at the limit Kitbag can correct',
};
const ROUTE_UNKNOWN = 'Can’t tell which output is in use. Try again.';
const USE_ANYWAY = 'Use anyway';

const NOTICE_TEXT: Readonly<Record<CalibrationNotice, string>> = {
  'route-changed': 'Output changed, so the run started again',
  'engine-restarted': 'Audio restarted, so the run started again',
};

const PHASE_TEXT: Partial<Readonly<Record<CalibrationPhase, string>>> = {
  busy: 'Stop the metronome to calibrate',
  failed: 'The click could not start; try again',
  'route-failed': 'Couldn’t read the audio output. Try again.',
  stopped: 'The click stopped. Start over to calibrate.',
};

export const SCATTER = {
  minHalfRangeMs: 50,
  sdSpan: 3,
  dotTop: 0.2,
  dotSpan: 0.6,
  dotStep: 0.618034,
} as const;

const CENTRE = 0.5;

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
  readonly showUse: boolean;
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

export function scatterHalfRangeMs(meanMs: number, sdMs: number): number {
  return Math.max(
    SCATTER.minHalfRangeMs,
    Math.abs(meanMs) + SCATTER.sdSpan * sdMs,
  );
}

export function scatterX(deviationMs: number, halfRangeMs: number): number {
  const x = CENTRE + deviationMs / (2 * halfRangeMs);
  return Math.min(1, Math.max(0, x));
}

function lateness(offsetMs: number): string {
  if (offsetMs > 0) return 'LATE';
  if (offsetMs < 0) return 'EARLY';
  return 'ON TIME';
}

function dotY(index: number): number {
  return SCATTER.dotTop + ((index * SCATTER.dotStep) % 1) * SCATTER.dotSpan;
}

function resultOf(
  state: ViewState,
  live: CalibrationOutcome,
): CalibrationResultView | null {
  const phaseText = PHASE_TEXT[state.phase];
  if (phaseText !== undefined) return { kind: 'message', text: phaseText };
  if (state.notice !== null) {
    return { kind: 'message', text: NOTICE_TEXT[state.notice] };
  }
  if (live.kind === 'refused') {
    return state.phase === 'done'
      ? { kind: 'message', text: REFUSED[live.reason] }
      : null;
  }
  if (state.phase === 'done' && state.route?.certain !== true) {
    return { kind: 'message', text: ROUTE_UNKNOWN };
  }
  const offsetMs = storedOffsetMs(live.meanMs);
  const spread = `±${String(Math.round(live.sdMs))} ms`;
  return {
    kind: 'measured',
    badge: `${formatOffsetMs(offsetMs)} ${lateness(offsetMs)} · ${spread}`,
    useLabel: live.steady ? `Use ${formatOffsetMs(offsetMs)}` : USE_ANYWAY,
  };
}

export function calibrationView(state: ViewState): CalibrationView {
  const live = analyseTaps(state.deviations);
  const measured = live.kind === 'measured' ? live : null;
  const axisMs = scatterHalfRangeMs(measured?.meanMs ?? 0, measured?.sdMs ?? 0);
  const refused = state.phase === 'done' && live.kind === 'refused';
  return {
    count: state.deviations.length,
    progress: state.deviations.length / CALIBRATION.taps,
    dots: state.deviations.map((deviation, index) => ({
      x: scatterX(deviation, axisMs),
      y: dotY(index),
    })),
    meanX: measured === null ? null : scatterX(measured.meanMs, axisMs),
    axisMs,
    result: resultOf(state, live),
    canUse: canUseOutcome(state),
    showUse: !refused,
  };
}
