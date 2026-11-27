import type { PickedDocument } from '@kitbag/core-native';

type Items = readonly PickedDocument[];

export interface IntakeSource {
  readonly takeInitial: () => Promise<Items>;
  readonly watch: (listener: (items: Items) => void) => () => void;
}

const warn = (error: unknown) => {
  console.warn('[kitbag] opening a shared file failed', error);
};

export function intakeSession(source: IntakeSource) {
  let initialTaken = false;
  let queue: Promise<void> = Promise.resolve();
  return {
    start: (receive: (items: Items) => Promise<void>) => {
      const deliver = (items: Items) => {
        queue = queue.then(() => receive(items)).catch(warn);
      };
      const stop = source.watch(deliver);
      if (!initialTaken) {
        initialTaken = true;
        source.takeInitial().then(deliver, warn);
      }
      return stop;
    },
  };
}
