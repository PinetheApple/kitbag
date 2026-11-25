import type { PlayerFrame } from '@kitbag/core-design';

export type SongPlayhead = PlayerFrame & {
  readonly songSec: PlayerFrame['progress'];
};

export interface PlayheadOptions {
  readonly countEndFrame?: number | null;
  readonly heldFrame?: number | null;
}

export type UsePlayhead = (
  engineRate: number,
  durationFrames: number,
  loopEndFrames: number | null,
  options?: PlayheadOptions,
) => SongPlayhead;
