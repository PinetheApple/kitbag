import type { MoveFinished } from '@kitbag/core-native';
import type { DataFolderStore } from '@kitbag/core-state';

import {
  CLOSED,
  nextDataFolderStep,
  settledOutcome,
  type DataFolderAction,
  type DataFolderEvent,
  type DataFolderStep,
} from './dataFolderFlow.ts';
import { outcomeText, undoneText, type Places } from './dataFolderMoveText.ts';

export interface DataFolderStoreApi {
  readonly getState: () => DataFolderStore;
  readonly subscribe: (
    listener: (state: DataFolderStore, previous: DataFolderStore) => void,
  ) => () => void;
}

export interface DataFolderSheetController {
  readonly step: () => DataFolderStep;
  readonly subscribe: (listener: () => void) => () => void;
  readonly open: () => void;
  readonly close: () => void;
  readonly choose: (target: string | null) => void;
  readonly act: Readonly<Record<DataFolderAction, () => void>>;
}

export function createDataFolderSheetController(
  store: DataFolderStoreApi,
  notify: (text: string) => void,
): DataFolderSheetController {
  let step: DataFolderStep = CLOSED;
  let places: Places = { source: null, target: null };
  const listeners = new Set<() => void>();
  const state = () => store.getState();

  const send = (event: DataFolderEvent) => {
    const next = nextDataFolderStep(step, event);
    if (next === step) return;
    step = next;
    listeners.forEach((listener) => {
      listener();
    });
  };

  const finish = (finished: MoveFinished) => {
    const { codes } = state();
    if (codes === null) return;
    send({
      kind: 'finished',
      settled: settledOutcome(finished, codes.moveOutcomes),
    });
    const text = outcomeText(finished, codes, places);
    if (text !== null) notify(text);
  };

  const follow = (now: DataFolderStore, before: DataFolderStore) => {
    if (now.move !== null) {
      places = {
        source: now.move.sourceVolumeUuid,
        target: now.move.targetVolumeUuid,
      };
      if (before.move === null) send({ kind: 'progressed' });
    }
    if (now.finished !== null && now.finished !== before.finished) {
      finish(now.finished);
    }
  };
  let stopFollowing: (() => void) | null = null;

  const settleAfter = (request: () => Promise<boolean>) => () => {
    void request().then(() => {
      send({ kind: 'requestSettled' });
    });
  };

  const close = () => {
    if (state().error !== null) state().dismissError();
    send({ kind: 'close' });
  };

  const startMove = () => {
    if (step.kind !== 'confirm') return;
    const { target } = step;
    places = { source: state().volumes?.currentVolumeUuid ?? null, target };
    send({ kind: 'start' });
    void state().startMove(target);
  };

  const undo = async () => {
    const source = state().move?.sourceVolumeUuid ?? null;
    if (!(await state().undoMove())) return;
    send({ kind: 'close' });
    notify(undoneText(source));
  };

  return {
    step: () => step,
    subscribe: (listener) => {
      listeners.add(listener);
      stopFollowing ??= store.subscribe(follow);
      return () => {
        listeners.delete(listener);
        if (listeners.size > 0) return;
        stopFollowing?.();
        stopFollowing = null;
      };
    },
    open: () => {
      send({ kind: 'open' });
    },
    close,
    choose: (target) => {
      send({ kind: 'choose', target });
    },
    act: {
      move: startMove,
      backToChooser: () => {
        send({ kind: 'back' });
      },
      askStop: () => {
        send({ kind: 'askStop' });
      },
      stop: settleAfter(() => state().cancelMove()),
      keepMoving: () => {
        send({ kind: 'keepMoving' });
      },
      resume: settleAfter(() => state().resumeMove()),
      undo: () => {
        void undo();
      },
      notNow: close,
      ok: close,
      chooseAnother: () => {
        state().dismissError();
        send({ kind: 'back' });
      },
    },
  };
}
