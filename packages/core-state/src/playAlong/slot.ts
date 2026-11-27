import { enterPlayAlongSlot, type PlayAlongPattern } from './pattern.ts';
import type { PlayAlongRuntime } from './runtime.ts';

export interface PlayAlongSlot {
  readonly enter: (otherClickStarting: () => void) => void;
  readonly leave: () => void;
  readonly held: () => boolean;
}

export function playAlongSlot(
  runtime: PlayAlongRuntime,
  pattern: () => PlayAlongPattern,
  latencyApplied: (latencyOffsetMs: number) => void,
): PlayAlongSlot {
  let leaving: (() => void) | undefined;
  return {
    enter: (otherClickStarting) => {
      if (leaving !== undefined) return;
      const latencyOffsetMs = runtime.latencyOffsetMs();
      const leaveSlot = enterPlayAlongSlot(
        runtime.commands,
        pattern(),
        latencyOffsetMs,
        runtime.yieldStandalone,
      );
      latencyApplied(latencyOffsetMs);
      const stopStarts = runtime.onClickStarting(otherClickStarting);
      const stopLatency = runtime.onLatencyOffset((offsetMs) => {
        runtime.commands.setLatencyOffset(offsetMs);
        latencyApplied(offsetMs);
      });
      leaving = () => {
        stopLatency();
        stopStarts();
        leaveSlot();
      };
    },
    leave: () => {
      const ending = leaving;
      leaving = undefined;
      ending?.();
    },
    held: () => leaving !== undefined,
  };
}
