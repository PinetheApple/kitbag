import { songPlayer, type EdgeStep, type ScrubEdge } from '@kitbag/core-design';
import { beatBeside, type LoopSeconds } from '@kitbag/core-state';

export function edgeSeconds(loop: LoopSeconds, edge: ScrubEdge): number {
  return edge === 'start' ? loop.startSec : loop.endSec;
}

export function steppedEdge(
  loop: LoopSeconds,
  edge: ScrubEdge,
  step: EdgeStep,
  beats: readonly number[],
): number {
  const from = edgeSeconds(loop, edge);
  return beatBeside(from, beats, step) ?? from + step * songPlayer.loopNudgeSec;
}
