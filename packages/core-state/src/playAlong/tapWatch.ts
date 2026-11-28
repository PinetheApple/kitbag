import type { MediaSessionSnapshot } from '@kitbag/core-native';

import { SEEK_JUMP_MS } from './follower.ts';
import { extrapolatedPositionMs } from './position.ts';
import type { PlayAlongRuntime } from './runtime.ts';
import { TAPS_CLEARED, type TapsCleared } from './tapAlongState.ts';
import {
  findSession,
  sameTrack,
  trackOf,
  type PlayAlongTrack,
} from './track.ts';

interface Watch {
  readonly stop: () => void;
  readonly track: PlayAlongTrack;
  seen: MediaSessionSnapshot;
}

function jumped(
  before: MediaSessionSnapshot,
  after: MediaSessionSnapshot,
  nowMs: number,
): boolean {
  const expected = extrapolatedPositionMs(before, nowMs);
  const reported = extrapolatedPositionMs(after, nowMs);
  return (
    expected !== null &&
    reported !== null &&
    Math.abs(reported - expected) > SEEK_JUMP_MS
  );
}

export function tapWatch(
  runtime: PlayAlongRuntime,
  onCleared: (reason: TapsCleared) => void,
) {
  let watch: Watch | undefined;

  const stop = () => {
    watch?.stop();
    watch = undefined;
  };

  const clear = (reason: TapsCleared) => {
    stop();
    onCleared(reason);
  };

  const onSessions = (sessions: readonly MediaSessionSnapshot[]) => {
    const current = watch;
    if (current === undefined) return;
    const seen = findSession(sessions, current.seen.sessionId);
    if (seen === undefined || !sameTrack(current.track, seen))
      clear(TAPS_CLEARED.track);
    else if (jumped(current.seen, seen, runtime.boottimeNowMs()))
      clear(TAPS_CLEARED.seek);
    else current.seen = seen;
  };

  const start = (seen: MediaSessionSnapshot) => {
    if (watch !== undefined) return;
    const unsubscribe = runtime.sessions().subscribe((state, previous) => {
      if (state.sessions !== previous.sessions) onSessions(state.sessions);
    });
    watch = { stop: unsubscribe, track: trackOf(seen), seen };
  };

  return { start, stop };
}
