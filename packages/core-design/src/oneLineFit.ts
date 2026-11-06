import { grownTextScale, isTextScaled } from './textScale.ts';
import type { TypeRole } from './tokens.ts';

export const MAX_SETTLE_PASSES = 3;

export interface FitPoint {
  readonly candidate: number;
  readonly textWidth: number;
}

export interface FitStep extends FitPoint {
  readonly available: number;
  readonly floor: number;
  readonly pass: number;
  readonly onePx: number;
  readonly previousPoint: FitPoint | undefined;
}

export type FitNext =
  | { readonly done: true; readonly fontSize: number }
  | { readonly done: false; readonly candidate: number };

// A flat or inverted pair of measurements (whole-px rounding) defines no line,
// so the step falls back to a single pixel rather than dividing by the slope.
function secantCandidate(
  { available, textWidth, candidate, onePx }: FitStep,
  previousPoint: FitPoint,
): number {
  const slope =
    (previousPoint.textWidth - textWidth) /
    (previousPoint.candidate - candidate);
  const solved =
    slope > 0 ? candidate + (available - textWidth) / slope : candidate;
  return solved - onePx;
}

// Android rounds the size up to whole px and scales sp nonlinearly, so a
// proportional fit can still overflow.
export function nextFitCandidate(step: FitStep): FitNext {
  const { available, textWidth, candidate, floor, pass, previousPoint } = step;
  if (textWidth <= available) return { done: true, fontSize: candidate };
  if (candidate <= floor || pass >= MAX_SETTLE_PASSES)
    return { done: true, fontSize: candidate };
  const proposed =
    previousPoint === undefined
      ? (candidate * available) / textWidth
      : secantCandidate(step, previousPoint);
  return { done: false, candidate: Math.max(floor, proposed) };
}

export function oneLineFloor(
  fontScale: number,
  size: number,
  minSize: number,
): number {
  return isTextScaled(fontScale) ? size / grownTextScale(fontScale) : minSize;
}

export interface FittedStyle {
  readonly fontSize: number;
  readonly letterSpacing?: number;
}

export function fittedStyle(role: TypeRole, fontSize: number): FittedStyle {
  return role.tracking === undefined
    ? { fontSize }
    : { fontSize, letterSpacing: fontSize * role.tracking };
}

export interface OneLineParams {
  readonly size: number;
  readonly floor: number;
  readonly onePx: number;
}

export interface OneLineSettle {
  readonly text: string;
  readonly generation: number;
  readonly available: number | undefined;
  readonly candidate: number;
  readonly pass: number;
  readonly textWidth: number | undefined;
  readonly previousPoint: FitPoint | undefined;
  readonly settled: boolean;
  readonly shown: number | undefined;
}

export interface OneLineMeasurement {
  readonly generation: number;
  readonly candidate: number;
  readonly textWidth: number;
}

export function startOneLine(
  text: string,
  size: number,
  previous?: OneLineSettle,
): OneLineSettle {
  return {
    text,
    generation: (previous?.generation ?? 0) + 1,
    available: previous?.available,
    candidate: size,
    pass: 0,
    textWidth: undefined,
    previousPoint: undefined,
    settled: false,
    shown: previous?.shown,
  };
}

function advance(state: OneLineSettle, params: OneLineParams): OneLineSettle {
  if (state.available === undefined || state.textWidth === undefined)
    return state;
  const next = nextFitCandidate({
    available: state.available,
    textWidth: state.textWidth,
    candidate: state.candidate,
    floor: params.floor,
    pass: state.pass,
    onePx: params.onePx,
    previousPoint: state.previousPoint,
  });
  return next.done
    ? { ...state, settled: true, shown: next.fontSize }
    : {
        ...state,
        candidate: next.candidate,
        pass: state.pass + 1,
        textWidth: undefined,
        previousPoint: {
          candidate: state.candidate,
          textWidth: state.textWidth,
        },
      };
}

export function resizeOneLine(
  state: OneLineSettle,
  available: number,
  params: OneLineParams,
): OneLineSettle {
  if (state.available === available) return state;
  if (state.available === undefined)
    return advance({ ...state, available }, params);
  return { ...startOneLine(state.text, params.size, state), available };
}

export function measureOneLine(
  state: OneLineSettle,
  measurement: OneLineMeasurement,
  params: OneLineParams,
): OneLineSettle {
  if (
    measurement.generation !== state.generation ||
    measurement.candidate !== state.candidate
  )
    return state;
  if (state.settled)
    return measurement.textWidth === state.textWidth
      ? state
      : startOneLine(state.text, params.size, state);
  return advance({ ...state, textWidth: measurement.textWidth }, params);
}
