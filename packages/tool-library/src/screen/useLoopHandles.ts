import type { EdgeStep, LoopHandles, ScrubEdge } from '@kitbag/core-design';
import {
  formatClockSeconds,
  framesToSeconds,
  useSongPlayer,
} from '@kitbag/core-state';
import { useCallback, useMemo } from 'react';

import { edgeSeconds, steppedEdge } from '../logic/loopHandles.ts';

export function useLoopHandles(): LoopHandles {
  const loop = useSongPlayer((s) => s.loop);
  const beats = useSongPlayer((s) => s.beats);
  const frames = useSongPlayer((s) => s.durationFrames);
  const rate = useSongPlayer((s) => s.engineRate);
  const moveLoopEdge = useSongPlayer((s) => s.moveLoopEdge);
  const durationSec = framesToSeconds(frames, rate);
  const onMoveLoopEdge = useCallback(
    (edge: ScrubEdge, fraction: number) =>
      moveLoopEdge(edge, fraction * durationSec),
    [moveLoopEdge, durationSec],
  );
  const onStepLoopEdge = useCallback(
    (edge: ScrubEdge, step: EdgeStep) => {
      if (loop.kind !== 'on') return;
      const target = steppedEdge(loop, edge, step, beats);
      if (target !== null) void moveLoopEdge(edge, target);
    },
    [moveLoopEdge, loop, beats],
  );
  const spokenEdge = useCallback(
    (edge: ScrubEdge) =>
      loop.kind === 'on' ? formatClockSeconds(edgeSeconds(loop, edge)) : '',
    [loop],
  );
  return useMemo(
    () => ({ onMoveLoopEdge, onStepLoopEdge, spokenEdge }),
    [onMoveLoopEdge, onStepLoopEdge, spokenEdge],
  );
}
