import type { IntakeEvent } from '@kitbag/core-native';

export interface IntakeSource {
  readonly takeLaunch: () => Promise<IntakeEvent>;
  readonly watch: (listener: (intake: IntakeEvent) => void) => () => void;
}

const warn = (error: unknown) => {
  console.warn('[kitbag] opening a shared file failed', error);
};

export function intakeSession(source: IntakeSource) {
  let queue: Promise<void> = Promise.resolve();
  return {
    start: (receive: (intake: IntakeEvent) => Promise<void>) => {
      const deliver = (intake: IntakeEvent) => {
        queue = queue.then(() => receive(intake)).catch(warn);
      };
      const stop = source.watch(deliver);
      source.takeLaunch().then(deliver, warn);
      return stop;
    },
  };
}
