export interface MixerOwner {
  readonly claim: (close: () => void) => void;
  readonly release: (close: () => void) => void;
}

export function createMixerOwner(): MixerOwner {
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

export const mixerOwner = createMixerOwner();
