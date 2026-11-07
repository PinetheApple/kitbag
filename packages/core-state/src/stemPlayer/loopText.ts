import { formatClockSeconds } from '../text.ts';
import type { LoopFailure, LoopState, StemPlayerState } from './store.ts';
import { secondsToFrames } from './time.ts';

export interface LoopMarkFractions {
  readonly start: number;
  readonly end: number | null;
}

export interface LoopNoteText {
  readonly text: string;
  readonly failed: boolean;
}

const FAILURES: Readonly<Record<LoopFailure, string>> = {
  tooShort: 'Loop too short',
  pastEnd: 'Loop runs past the end',
  engine: 'Loop not set, try again',
};

export function loopRange({
  startSec,
  endSec,
}: Readonly<Record<'startSec' | 'endSec', number>>): string {
  return `${formatClockSeconds(startSec)} – ${formatClockSeconds(endSec)}`;
}

function fractionOf(seconds: number, rate: number, frames: number): number {
  return frames > 0 ? (seconds * rate) / frames : 0;
}

export function loopMarks(
  loop: LoopState,
  engineRate: number,
  durationFrames: number,
): LoopMarkFractions | null {
  if (loop.kind === 'off') return null;
  return {
    start: fractionOf(loop.startSec, engineRate, durationFrames),
    end:
      loop.kind === 'armed'
        ? null
        : fractionOf(loop.endSec, engineRate, durationFrames),
  };
}

export function loopNote(
  loop: LoopState,
  failure: LoopFailure | null,
): LoopNoteText | null {
  if (failure !== null) return { text: FAILURES[failure], failed: true };
  if (loop.kind === 'armed')
    return {
      text: `Loop from ${formatClockSeconds(loop.startSec)}`,
      failed: false,
    };
  if (loop.kind === 'on')
    return {
      text: `Loop ${loopRange(loop)}`,
      failed: false,
    };
  return null;
}

export function loopEndFrames({
  loop,
  engineRate,
}: Pick<StemPlayerState, 'loop' | 'engineRate'>): number | null {
  return loop.kind === 'on' ? secondsToFrames(loop.endSec, engineRate) : null;
}

export function clickKeyLabel(click: boolean): string {
  return click ? 'Stop the click' : 'Click along on the song grid';
}

export function loopKeyLabel(loop: LoopState): string {
  if (loop.kind === 'off') return 'Loop: set the start here';
  if (loop.kind === 'armed') return 'Loop: set the end here';
  return 'Clear the loop';
}
