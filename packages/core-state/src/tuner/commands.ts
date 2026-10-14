import { KB_RESULT, type KitbagCommandsSpec } from '@kitbag/core-native';

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

// While the mic runs the engine queues setters for its analysis thread and
// answers KB_ERROR_BUSY when that queue is full (kitbag_tuner_api.h). The
// analysis thread drains it every hop, so a few retries a tick apart suffice.
export const MAX_BUSY_RETRIES = 3;

export type Wait = () => Promise<void>;

export const nextTick: Wait = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

/** Send a setter, retrying a bounded number of times while the engine is busy. */
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

// One queue for every tuner command: the engine requires all kb_tuner_* setters
// to come from one app thread, and a later command must not overtake an earlier
// one (set_tuning resets the mode, so a reordered pair leaves the wrong mode).
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
