import { countLabel } from '@kitbag/core-design';
import {
  formatClockSeconds,
  isSungLine,
  MINUS,
  nextSungLine,
  NO_LINE,
  RETIME_SHIFT_STEP_SEC,
  type LyricLine,
  type RetimeState,
  type RetimeTap,
} from '@kitbag/core-state';

const TENTHS = 10;
const SHIFT_DECIMALS = 2;

export interface RetimePreview {
  readonly done: { readonly text: string; readonly time: string } | null;
  readonly current: string | null;
  readonly next: string | null;
}

function sungCount(lines: readonly LyricLine[], end = lines.length): number {
  return lines.slice(0, end).filter(isSungLine).length;
}

export function retimeLineLabel(
  lines: readonly LyricLine[],
  nextLine: number,
): string {
  const total = String(sungCount(lines));
  if (nextLine === NO_LINE) return `All ${total} lines tapped`;
  return `Line ${String(sungCount(lines, nextLine) + 1)} of ${total}`;
}

export function retimeUnsaved(retime: RetimeState): boolean {
  return (
    retime.kind === 'recording' &&
    (retime.taps.length > 0 || retime.shiftSteps !== 0)
  );
}

export function leaveRetimeBody(taps: number, shiftSteps: number): string {
  const tapped = taps > 0 ? countLabel(taps, 'tap', 'taps') : null;
  const shifted = shiftSteps !== 0;
  const dropped =
    tapped === null ? 'offset' : shifted ? `${tapped} and offset` : tapped;
  const verb = taps > 1 || (tapped !== null && shifted) ? 'are' : 'is';
  return `Your ${dropped} for this song ${verb} dropped. The lyrics keep their current timing.`;
}

export function tapTimeLabel(seconds: number): string {
  const tenths = Math.round(seconds * TENTHS);
  const whole = Math.floor(tenths / TENTHS);
  return `${formatClockSeconds(whole)}.${String(tenths % TENTHS)}`;
}

export function shiftLabel(steps: number): string {
  const size = (Math.abs(steps) * RETIME_SHIFT_STEP_SEC).toFixed(
    SHIFT_DECIMALS,
  );
  if (steps === 0) return `${size} s`;
  return `${steps > 0 ? '+' : MINUS}${size} s`;
}

export function retimePreview(
  lines: readonly LyricLine[],
  taps: readonly RetimeTap[],
  nextLine: number,
): RetimePreview {
  const tap = taps.at(-1);
  const tapped = tap === undefined ? undefined : lines[tap.line];
  const after =
    nextLine === NO_LINE ? NO_LINE : nextSungLine(lines, nextLine + 1);
  return {
    done:
      tap === undefined || tapped === undefined
        ? null
        : { text: tapped.text, time: tapTimeLabel(tap.timeSec) },
    current: lines[nextLine]?.text ?? null,
    next: lines[after]?.text ?? null,
  };
}
