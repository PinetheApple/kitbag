import { KB_MIXER_RATE_BOUNDS, KB_RESULT } from '@kitbag/core-native';

import type { StemPlayerCommands } from './runtime.ts';

export const RETIME_PLAYBACK_RATE = 0.75;

type RateCommands = Pick<StemPlayerCommands, 'mixerRate' | 'mixerSetRate'>;
type OnPlaying = (rate: number) => void;

export interface RetimeSpeed {
  readonly enter: (onPlaying: OnPlaying) => void;
  readonly restore: () => Promise<void>;
}

interface SessionRates {
  readonly session: number;
  owed: number | null;
  known: number | null;
}

const restorable = (rate: number) =>
  rate >= KB_MIXER_RATE_BOUNDS.min && rate <= KB_MIXER_RATE_BOUNDS.max;

// Steps run in order, so a restore never overtakes the slow-down it undoes.
// kb_mixer_rate trails a set by up to a block, so the last rate set wins over a read.
export function retimeSpeed(
  commandsOf: () => RateCommands,
  session: () => number,
  onRate: (rate: number) => void,
): RetimeSpeed {
  let steps: Promise<void> = Promise.resolve();
  let generation = 0;
  let rates: SessionRates = { session: session(), owed: null, known: null };

  const queue = (step: () => Promise<void>) => {
    steps = steps.then(step).catch((error: unknown) => {
      console.warn('[kitbag] retime speed not changed', error);
    });
  };
  const ratesFor = (opened: number) => {
    if (rates.session !== opened) {
      rates = { session: opened, owed: null, known: null };
    }
    return rates;
  };
  const setRate = async (current: SessionRates, rate: number) => {
    const result = await commandsOf()
      .mixerSetRate(rate)
      .catch((error: unknown) => {
        current.known = null;
        throw error;
      });
    if (result !== KB_RESULT.KB_OK) {
      throw new Error(`kb_result ${String(result)}`);
    }
    current.known = rate;
    onRate(rate);
  };
  const speedBefore = async (current: SessionRates) => {
    if (current.owed !== null) return current.owed;
    if (current.known !== null) return current.known;
    const read = await commandsOf().mixerRate();
    if (!restorable(read)) throw new Error(`speed ${String(read)}`);
    current.known = read;
    onRate(read);
    return read;
  };
  const slowDown = (mine: number, opened: number, onPlaying: OnPlaying) => {
    return async () => {
      const current = ratesFor(opened);
      const previous = await speedBefore(current);
      if (mine !== generation) return;
      if (previous <= RETIME_PLAYBACK_RATE) {
        onPlaying(previous);
        return;
      }
      await setRate(current, RETIME_PLAYBACK_RATE);
      current.owed = previous;
      if (mine === generation) onPlaying(RETIME_PLAYBACK_RATE);
    };
  };
  const putBack = async () => {
    const current = rates;
    if (current.owed === null) return;
    await setRate(current, current.owed);
    current.owed = null;
  };

  return {
    enter: (onPlaying) => {
      queue(slowDown(++generation, session(), onPlaying));
    },
    restore: () => {
      generation++;
      queue(putBack);
      return steps;
    },
  };
}
