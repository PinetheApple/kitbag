import { KB_MIXER_RATE_BOUNDS, KB_RESULT } from '@kitbag/core-native';

import type { StemPlayerCommands } from './runtime.ts';

export const RETIME_PLAYBACK_RATE = 0.75;

type RateCommands = Pick<StemPlayerCommands, 'mixerRate' | 'mixerSetRate'>;

export interface RetimeSpeed {
  readonly enter: (onPlaying: (rate: number) => void) => void;
  readonly restore: () => void;
}

const restorable = (rate: number) =>
  rate >= KB_MIXER_RATE_BOUNDS.min && rate <= KB_MIXER_RATE_BOUNDS.max;

// Steps run in order, so a restore never overtakes the slow-down it undoes.
// A refused restore stays owed: re-reading would take the stuck retime speed.
export function retimeSpeed(commandsOf: () => RateCommands): RetimeSpeed {
  let steps: Promise<void> = Promise.resolve();
  let entry = 0;
  let owed: number | null = null;
  const queue = (step: () => Promise<void>) => {
    steps = steps.then(step).catch((error: unknown) => {
      console.warn('[kitbag] retime speed not changed', error);
    });
  };
  const setRate = async (rate: number) => {
    const result = await commandsOf().mixerSetRate(rate);
    if (result !== KB_RESULT.KB_OK)
      throw new Error(`kb_result ${String(result)}`);
  };
  return {
    enter: (onPlaying) => {
      const entering = ++entry;
      queue(async () => {
        const previous = owed ?? (await commandsOf().mixerRate());
        if (entering !== entry) return;
        if (!restorable(previous)) throw new Error(`speed ${String(previous)}`);
        if (previous <= RETIME_PLAYBACK_RATE) {
          onPlaying(previous);
          return;
        }
        await setRate(RETIME_PLAYBACK_RATE);
        owed = previous;
        if (entering === entry) onPlaying(RETIME_PLAYBACK_RATE);
      });
    },
    restore: () => {
      entry++;
      queue(async () => {
        if (owed === null) return;
        await setRate(owed);
        owed = null;
      });
    },
  };
}
