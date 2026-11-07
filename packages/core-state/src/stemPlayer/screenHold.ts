import { useLayoutEffect, useState } from 'react';

import type { MixerHold } from './mixerSession.ts';

export function screenHold() {
  let hold: MixerHold | null = null;
  return {
    ensureHeld: (acquire: () => MixerHold) => {
      if (hold?.live() !== true) hold = acquire();
    },
    release: () => {
      hold?.release();
      hold = null;
    },
  };
}

export function useFocusedMixerHold(
  focused: boolean,
  acquire: () => MixerHold,
): void {
  const [screen] = useState(screenHold);
  // Before paint, so a refocused screen does not draw the displacing song's state.
  useLayoutEffect(() => {
    if (focused) screen.ensureHeld(acquire);
  }, [screen, focused, acquire]);
  useLayoutEffect(() => screen.release, [screen, acquire]);
}
