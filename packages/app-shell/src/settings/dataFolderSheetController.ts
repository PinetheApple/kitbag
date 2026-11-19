import type {
  DataFolderVolumes,
  MoveFinished,
  MoveStatus,
} from '@kitbag/core-native';
import { moveSettled, type DataFolderStore } from '@kitbag/core-state';

import {
  CLOSED,
  nextDataFolderStep,
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
  readonly offerReturn: (volumeUuid: string) => void;
  readonly returning: () => boolean;
  readonly places: () => Places;
  readonly setFocused: (focused: boolean) => void;
  readonly close: () => void;
  readonly choose: (target: string | null) => void;
  readonly act: Readonly<Record<DataFolderAction, () => void>>;
}

function otherPlace(volumes: DataFolderVolumes | null): string | null {
  return volumes?.volumes.find((volume) => !volume.inUse)?.volumeUuid ?? null;
}

function cardIn(state: DataFolderStore, volumeUuid: string): boolean {
  const { volumes, codes } = state;
  return (
    volumes?.volumes.some(
      (volume) =>
        volume.volumeUuid === volumeUuid &&
        volume.state === codes?.volumeStates.mounted,
    ) === true
  );
}

export function createDataFolderSheetController(
  store: DataFolderStoreApi,
  notify: (text: string) => void,
): DataFolderSheetController {
  let step: DataFolderStep = CLOSED;
  let places: Places = { source: null, target: null };
  let focused = true;
  const listeners = new Set<() => void>();
  const state = () => store.getState();

  // Stacked screens each host the sheets; only the one on screen speaks.
  const post = (text: string) => {
    if (focused) notify(text);
  };

  const currentPlaces = (): Places => {
    const { move, volumes } = state();
    if (move !== null) {
      return {
        source: move.sourceVolumeUuid,
        target: move.targetVolumeUuid,
        cardReturn: move.cardReturn,
      };
    }
    if (places.cardReturn === true) return places;
    const chosen =
      step.kind === 'confirm' || step.kind === 'starting'
        ? step.target
        : otherPlace(volumes);
    return {
      source: volumes?.currentVolumeUuid ?? null,
      target: chosen,
      cardReturn: false,
    };
  };

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
      settled: moveSettled(finished, codes.moveOutcomes),
    });
    const text = outcomeText(finished, codes, places);
    if (text !== null) post(text);
  };

  const remember = (move: MoveStatus | null) => {
    if (move === null) return;
    places = {
      source: move.sourceVolumeUuid,
      target: move.targetVolumeUuid,
      cardReturn: move.cardReturn,
    };
  };

  const follow = (now: DataFolderStore, before: DataFolderStore) => {
    remember(now.move);
    if (step.kind === 'returnOffer' && !cardIn(now, step.volumeUuid)) {
      send({ kind: 'close' });
    }
    if (now.move !== null && before.move === null) {
      send({ kind: 'progressed' });
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
    void state()
      .startMove(target)
      .then((acted) => {
        if (!acted) send({ kind: 'requestSettled' });
      });
  };

  const returnCard = () => {
    if (step.kind !== 'returnOffer') return;
    const { volumeUuid } = step;
    const target = state().volumes?.currentVolumeUuid ?? null;
    places = { source: volumeUuid, target, cardReturn: true };
    send({ kind: 'start' });
    void state()
      .returnCard(volumeUuid)
      .then((acted) => {
        if (!acted) send({ kind: 'requestSettled' });
      });
  };

  const declineReturn = () => {
    if (step.kind !== 'returnOffer') return;
    state().declineReturn(step.volumeUuid);
    send({ kind: 'close' });
  };

  const undo = async () => {
    const source = state().move?.sourceVolumeUuid ?? null;
    if (!(await state().undoMove())) return;
    send({ kind: 'close' });
    post(undoneText(source));
  };

  return {
    step: () => step,
    subscribe: (listener) => {
      listeners.add(listener);
      if (stopFollowing === null) {
        remember(state().move);
        stopFollowing = store.subscribe(follow);
      }
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
    offerReturn: (volumeUuid) => {
      send({ kind: 'offerReturn', volumeUuid });
    },
    returning: () => places.cardReturn === true,
    places: currentPlaces,
    setFocused: (next) => {
      focused = next;
    },
    close,
    choose: (target) => {
      send({ kind: 'choose', target });
    },
    act: {
      move: startMove,
      returnMove: returnCard,
      declineReturn,
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
