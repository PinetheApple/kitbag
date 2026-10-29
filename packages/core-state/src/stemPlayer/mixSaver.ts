import type { StemMix } from '@kitbag/core-db';

import { debounce } from './debounce.ts';

export interface MixSaver {
  readonly queue: (mix: StemMix) => void;
  readonly flush: () => void;
}

export function mixSaver(
  save: (mixes: readonly StemMix[]) => Promise<void>,
  delayMs: number,
): MixSaver {
  const pending = new Map<number, StemMix>();
  const writeNow = () => {
    const mixes = [...pending.values()];
    pending.clear();
    if (mixes.length === 0) return;
    save(mixes).catch((error: unknown) => {
      console.warn('[kitbag] stem mix was not saved', error);
    });
  };
  const write = debounce(writeNow, delayMs);
  return {
    queue: (mix) => {
      pending.set(mix.id, mix);
      write();
    },
    flush: () => {
      write.cancel();
      writeNow();
    },
  };
}
