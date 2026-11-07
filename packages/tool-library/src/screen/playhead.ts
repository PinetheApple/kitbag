import type { PlayerFrame } from '@kitbag/core-design';

export type UsePlayhead = (
  engineRate: number,
  durationFrames: number,
  loopEndFrames: number | null,
) => PlayerFrame;
