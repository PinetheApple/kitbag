import type { EdgeStep, ScrubEdge } from '@kitbag/core-design';
import { beatBeside, type LoopSeconds } from '@kitbag/core-state';

export const GRIDLESS_STEP_SECONDS = 1;

export function edgeSeconds(loop: LoopSeconds, edge: ScrubEdge): number {
  return edge === 'start' ? loop.startSec : loop.endSec;
}

function clearOfOtherEdge(
  loop: LoopSeconds,
  edge: ScrubEdge,
  seconds: number,
): boolean {
  return edge === 'start' ? seconds < loop.endSec : seconds > loop.startSec;
}

export function steppedEdge(
  loop: LoopSeconds,
  edge: ScrubEdge,
  step: EdgeStep,
  beats: readonly number[],
): number | null {
  const from = edgeSeconds(loop, edge);
  const target =
    beats.length === 0
      ? from + step * GRIDLESS_STEP_SECONDS
      : beatBeside(from, beats, step);
  return target !== null && clearOfOtherEdge(loop, edge, target)
    ? target
    : null;
}
