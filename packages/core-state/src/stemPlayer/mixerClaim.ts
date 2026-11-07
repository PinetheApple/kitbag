export interface MixerClaim {
  readonly claim: (close: () => void) => void;
  readonly release: (close: () => void) => void;
}

export function createMixerClaim(): MixerClaim {
  let current: (() => void) | null = null;
  return {
    claim: (close) => {
      const previous = current;
      current = close;
      if (previous !== null && previous !== close) previous();
    },
    release: (close) => {
      if (current === close) current = null;
    },
  };
}

export const mixerClaim = createMixerClaim();
