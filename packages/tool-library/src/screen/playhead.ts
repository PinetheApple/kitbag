import type { PlayerFrame } from '@kitbag/core-design';

export type SongPlayhead = PlayerFrame & {
  readonly songSec: PlayerFrame['progress'];
};

export type UsePlayhead = (
  engineRate: number,
  durationFrames: number,
  loopEndFrames: number | null,
  countEndFrame?: number | null,
  heldFrame?: number | null,
) => SongPlayhead;
