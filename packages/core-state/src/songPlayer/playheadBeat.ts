import { snapToBeat } from '../stemPlayer/loop.ts';
import { framesToSeconds } from '../stemPlayer/time.ts';
import type { SongPlayerRuntime } from './runtime.ts';
import type { SongPlayerState } from './state.ts';

export function playheadBeatSeconds(
  state: Pick<SongPlayerState, 'beats' | 'engineRate'>,
  runtime: SongPlayerRuntime,
): number | null {
  const { beats, engineRate } = state;
  if (beats.length === 0) return null;
  const playhead = framesToSeconds(runtime.engine.position(), engineRate);
  return snapToBeat(playhead, beats);
}
