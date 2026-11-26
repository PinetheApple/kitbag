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
): PlayAlongSlot {
  let leaving: (() => void) | undefined;
  return {
    enter: (otherClickStarting) => {
      if (leaving !== undefined) return;
      const leaveSlot = enterPlayAlongSlot(
        runtime.commands,
        pattern(),
        runtime.latencyOffsetMs(),
        runtime.yieldStandalone,
      );
      const stopStarts = runtime.onClickStarting(otherClickStarting);
      leaving = () => {
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
