export interface MixerClaim {
  readonly claim: (close: () => void) => void;
  readonly release: (close: () => void) => void;
  readonly defer: (work: Promise<unknown>) => void;
  readonly settled: () => Promise<void>;
}

export function createMixerClaim(): MixerClaim {
  let current: (() => void) | null = null;
  let pending: Promise<void> = Promise.resolve();
  return {
    claim: (close) => {
      const previous = current;
      current = close;
      if (previous !== null && previous !== close) previous();
    },
    release: (close) => {
      if (current === close) current = null;
    },
    defer: (work) => {
      const settledWork = work.then(
        () => undefined,
        () => undefined,
      );
      pending = pending.then(() => settledWork);
    },
    settled: () => pending,
  };
}

export const mixerClaim = createMixerClaim();
