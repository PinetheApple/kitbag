import { dataFolderStore, useDataFolder } from '@kitbag/core-state';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

import {
  CLOSED,
  dataFolderSheet,
  nextDataFolderStep,
  settledOutcome,
  sheetActions,
  type DataFolderAction,
  type DataFolderEvent,
} from './dataFolderFlow.ts';
import { outcomeText, undoneText } from './dataFolderMoveText.ts';

export function useDataFolderSheets(onNotice: (text: string) => void) {
  const [step, send] = useReducer(nextDataFolderStep, CLOSED);
  const move = useDataFolder((s) => s.move);
  const error = useDataFolder((s) => s.error);
  const pending = useDataFolder((s) => s.pending);
  const finished = useDataFolder((s) => s.finished);
  const codes = useDataFolder((s) => s.codes);
  const sheet = dataFolderSheet({ move, error }, step);
  const actions = sheetActions(sheet, pending);

  useFocusEffect(
    useCallback(() => {
      void dataFolderStore.getState().refreshVolumes();
    }, []),
  );

  const seen = useRef(finished);
  useEffect(() => {
    if (finished === null || finished === seen.current || codes === null) {
      return;
    }
    seen.current = finished;
    send({
      kind: 'finished',
      settled: settledOutcome(finished, codes.moveOutcomes),
    });
    const text = outcomeText(
      finished,
      codes,
      dataFolderStore.getState().volumes?.currentVolumeUuid ?? null,
    );
    if (text !== null) onNotice(text);
  }, [finished, codes, onNotice]);

  const handlers = useMemo(() => {
    const on = (event: DataFolderEvent) => () => {
      send(event);
    };
    const request = (call: () => Promise<void>) => () => {
      void call().then(() => {
        send({ kind: 'acted' });
      });
    };
    const store = () => dataFolderStore.getState();
    const undo = async () => {
      const source = store().move?.sourceVolumeUuid ?? null;
      await store().undoMove();
      if (store().error !== null) return;
      send({ kind: 'close' });
      onNotice(undoneText(source));
    };
    const dismissThen = (event: DataFolderEvent) => () => {
      store().dismissError();
      send(event);
    };
    return {
      open: on({ kind: 'open' }),
      close: on({ kind: 'close' }),
      choose: (target: string | null) => {
        send({ kind: 'choose', target });
      },
      byAction: {
        move: () => {
          void store().startMove(step.kind === 'confirm' ? step.target : null);
        },
        backToChooser: on({ kind: 'back' }),
        askStop: on({ kind: 'askStop' }),
        stop: request(() => store().cancelMove()),
        keepMoving: on({ kind: 'keepMoving' }),
        resume: request(() => store().resumeMove()),
        undo: () => {
          void undo();
        },
        ok: dismissThen({ kind: 'close' }),
        chooseAnother: dismissThen({ kind: 'acted' }),
      } satisfies Record<DataFolderAction, () => void>,
    };
  }, [onNotice, step]);

  const confirmTarget = step.kind === 'confirm' ? step.target : null;
  return { sheet, actions, pending, codes, confirmTarget, ...handlers };
}
