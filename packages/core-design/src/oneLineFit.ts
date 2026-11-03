import { grownTextScale, isTextScaled } from './textScale.ts';
import type { TypeRole } from './tokens.ts';

export const MAX_SETTLE_PASSES = 3;

export interface FitStep {
  readonly available: number;
  readonly width: number;
  readonly candidate: number;
  readonly floor: number;
  readonly pass: number;
  readonly onePx: number;
}

export type FitNext =
  | { readonly done: true; readonly fontSize: number }
  | { readonly done: false; readonly candidate: number };

// Android rounds the size up to whole px and scales sp nonlinearly, so a
// proportional fit can still overflow; later passes step a pixel lower.
export function nextFitCandidate({
  available,
  width,
  candidate,
  floor,
  pass,
  onePx,
}: FitStep): FitNext {
  if (width <= available) return { done: true, fontSize: candidate };
  if (candidate <= floor || pass >= MAX_SETTLE_PASSES)
    return { done: true, fontSize: candidate };
  const scaled = (candidate * available) / width - (pass === 0 ? 0 : onePx);
  return { done: false, candidate: Math.max(floor, scaled) };
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
  readonly width: number | undefined;
  readonly settled: boolean;
  readonly shown: number | undefined;
}

export interface OneLineMeasurement {
  readonly text: string;
  readonly generation: number;
  readonly candidate: number;
  readonly width: number;
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
    width: undefined,
    settled: false,
    shown: previous?.shown,
  };
}

function advance(state: OneLineSettle, params: OneLineParams): OneLineSettle {
  if (state.available === undefined || state.width === undefined) return state;
  const next = nextFitCandidate({
    available: state.available,
    width: state.width,
    candidate: state.candidate,
    floor: params.floor,
    pass: state.pass,
    onePx: params.onePx,
  });
  return next.done
    ? { ...state, settled: true, shown: next.fontSize }
    : {
        ...state,
        candidate: next.candidate,
        pass: state.pass + 1,
        width: undefined,
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
    measurement.text !== state.text ||
    measurement.generation !== state.generation ||
    measurement.candidate !== state.candidate
  )
    return state;
  if (state.settled)
    return measurement.width === state.width
      ? state
      : startOneLine(state.text, params.size, state);
  return advance({ ...state, width: measurement.width }, params);
}
