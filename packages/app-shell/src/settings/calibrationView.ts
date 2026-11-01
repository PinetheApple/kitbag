import {
  bodyLineHeight,
  calibration,
  calibrationText,
} from '@kitbag/core-design';
import type { OutputRoute } from '@kitbag/core-native';
import {
  analyseTaps,
  BEAT_MS,
  canUseOutcome,
  CALIBRATION,
  formatOffsetMs,
  mean,
  routeDetail,
  sampleSd,
  storedOffsetMs,
  unwrapDeviations,
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
  axisStepMs: { tight: 50, steady: 100, loose: 200, nearLimit: 400 },
  sdSpan: 3,
  dotTop: 0.2,
  dotSpan: 0.6,
  dotStep: 0.618034,
} as const;

export const SCATTER_AXIS_STEPS_MS: readonly number[] = [
  ...Object.values(SCATTER.axisStepMs),
  BEAT_MS,
];

export const SCATTER_AXIS_LINE_HEIGHT =
  calibrationText.scatterAxis.size * bodyLineHeight;

export const SCATTER_DOT_BAND = {
  top: 0,
  bottom: calibration.axisBottom + SCATTER_AXIS_LINE_HEIGHT,
  left: calibration.axisSide,
  right: calibration.axisSide,
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
  const spanMs = Math.abs(meanMs) + SCATTER.sdSpan * sdMs;
  return SCATTER_AXIS_STEPS_MS.find((step) => step >= spanMs) ?? BEAT_MS;
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
  const refused = state.phase === 'done' && live.kind === 'refused';
  const unwrapped = unwrapDeviations(state.deviations);
  const axisMs =
    measured === null
      ? scatterHalfRangeMs(mean(unwrapped), sampleSd(unwrapped))
      : scatterHalfRangeMs(measured.meanMs, measured.sdMs);
  return {
    count: state.deviations.length,
    progress: state.deviations.length / CALIBRATION.taps,
    dots: unwrapped.map((deviation, index) => ({
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
