import {
  KB_RESULT,
  KB_TUNER_IDLE_SLEEP_MICROS,
  type KitbagCommandsSpec,
} from '@kitbag/core-native';

export type TunerCommands = Pick<
  KitbagCommandsSpec,
  | 'tunerStart'
  | 'tunerStop'
  | 'tunerSetTuning'
  | 'tunerSetTargetString'
  | 'tunerSetChromatic'
  | 'tunerSetA4'
  | 'tunerResetNotePresence'
>;

// A full setter queue answers KB_ERROR_BUSY. The analysis thread drains it once
// per loop and idles up to KB_TUNER_IDLE_SLEEP_MICROS, so a retry waits that long.
export const MAX_BUSY_RETRIES = 3;

const MICROS_PER_MS = 1000;

export type Wait = () => Promise<void>;

export const busyRetryDelay: Wait = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, Math.ceil(KB_TUNER_IDLE_SLEEP_MICROS / MICROS_PER_MS));
  });

export async function sendWithBusyRetry(
  send: () => Promise<number>,
  wait: Wait,
): Promise<number> {
  let result = await send();
  for (
    let retry = 0;
    result === KB_RESULT.KB_ERROR_BUSY && retry < MAX_BUSY_RETRIES;
    retry++
  ) {
    await wait();
    result = await send();
  }
  return result;
}

export interface CommandQueue {
  /** Run `task` after every task enqueued before it has settled. */
  readonly run: <T>(task: () => Promise<T>) => Promise<T>;
  /** Resolves once everything enqueued so far has settled. */
  readonly idle: () => Promise<void>;
}

// One queue for every tuner command: a later command must not overtake an
// earlier one (set_tuning resets the mode, so a reordered pair leaves the
// wrong mode).
export function createCommandQueue(): CommandQueue {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    run: (task) => {
      const result = tail.then(task);
      tail = result.catch(() => undefined);
      return result;
    },
    idle: () => tail.then(() => undefined),
  };
}
