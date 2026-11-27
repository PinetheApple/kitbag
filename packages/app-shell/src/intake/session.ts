import type { IntakeEvent } from '@kitbag/core-native';

export interface IntakeSource {
  readonly takeLaunch: () => Promise<IntakeEvent>;
  readonly watch: (listener: () => void) => () => void;
}

const warn = (error: unknown) => {
  console.warn('[kitbag] opening a shared file failed', error);
};

export function intakeSession(source: IntakeSource) {
  let queue: Promise<void> = Promise.resolve();
  return {
    start: (receive: (intake: IntakeEvent) => Promise<void>) => {
      const drain = () => {
        queue = queue
          .then(() => source.takeLaunch())
          .then(receive)
          .catch(warn);
      };
      const stop = source.watch(drain);
      drain();
      return stop;
    },
  };
}
