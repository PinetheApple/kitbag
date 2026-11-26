import type { PlayAlongPattern } from './pattern.ts';
import { enterPlayAlongSlot } from './pattern.ts';
import type { PlayAlongRuntime } from './runtime.ts';

export interface PlayAlongSlot {
  readonly enter: () => void;
  readonly leave: () => void;
  readonly held: () => boolean;
}

export function playAlongSlot(
  runtime: PlayAlongRuntime,
  pattern: () => PlayAlongPattern,
  ended: () => void,
): PlayAlongSlot {
  let leaving: (() => void) | undefined;
  return {
    enter: () => {
      if (leaving !== undefined) return;
      const leaveSlot = enterPlayAlongSlot(
        runtime.commands,
        pattern(),
        runtime.latencyOffsetMs(),
        runtime.yieldStandalone,
      );
      const stopStarts = runtime.onClickStarting(ended);
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
