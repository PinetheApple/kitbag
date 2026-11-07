import { useLayoutEffect, useState } from 'react';

export type MixerHold = (() => void) & { readonly live: () => boolean };

export function screenHold() {
  let hold: MixerHold | null = null;
  return {
    focus: (acquire: () => MixerHold) => {
      if (hold?.live() !== true) hold = acquire();
    },
    leave: () => {
      hold?.();
      hold = null;
    },
  };
}

export function useFocusedMixerHold(
  focused: boolean,
  acquire: () => MixerHold,
): void {
  const [hold] = useState(screenHold);
  // Before paint, so a refocused screen does not draw the displacing song's state.
  useLayoutEffect(() => {
    if (focused) hold.focus(acquire);
  }, [hold, focused, acquire]);
  useLayoutEffect(() => hold.leave, [hold, acquire]);
}
