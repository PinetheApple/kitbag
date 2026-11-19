import type { MoveFinished, MoveStatus } from '@kitbag/core-native';
import type { DataFolderStore } from '@kitbag/core-state';

import { moveUnderWay } from './dataFolderText.ts';

export type DataFolderStep =
  | { readonly kind: 'closed' }
  | { readonly kind: 'open' }
  | { readonly kind: 'confirm'; readonly target: string | null }
  | { readonly kind: 'stopAsk' };

export type DataFolderEvent =
  | { readonly kind: 'open' }
  | { readonly kind: 'choose'; readonly target: string | null }
  | { readonly kind: 'back' }
  | { readonly kind: 'askStop' }
  | { readonly kind: 'keepMoving' }
  | { readonly kind: 'acted' }
  | { readonly kind: 'finished'; readonly settled: boolean }
  | { readonly kind: 'close' };

export const CLOSED: DataFolderStep = { kind: 'closed' };

export function nextDataFolderStep(
  step: DataFolderStep,
  event: DataFolderEvent,
): DataFolderStep {
  switch (event.kind) {
    case 'open':
    case 'back':
    case 'keepMoving':
    case 'acted':
      return { kind: 'open' };
    case 'choose':
      return { kind: 'confirm', target: event.target };
    case 'askStop':
      return { kind: 'stopAsk' };
    case 'finished':
      return event.settled || step.kind === 'closed'
        ? CLOSED
        : { kind: 'open' };
    case 'close':
      return CLOSED;
  }
}

export type DataFolderAction =
  | 'move'
  | 'backToChooser'
  | 'askStop'
  | 'stop'
  | 'keepMoving'
  | 'resume'
  | 'undo'
  | 'ok'
  | 'chooseAnother';

export interface SheetAction {
  readonly id: DataFolderAction;
  readonly primary: boolean;
  readonly disabled: boolean;
}

export type DataFolderSheet =
  | { readonly kind: 'none' }
  | { readonly kind: 'chooser' }
  | { readonly kind: 'confirm'; readonly target: string | null }
  | { readonly kind: 'moving'; readonly move: MoveStatus }
  | { readonly kind: 'stopAsk'; readonly move: MoveStatus }
  | {
      readonly kind: 'paused';
      readonly move: MoveStatus;
      readonly error: string | null;
    }
  | { readonly kind: 'failed'; readonly error: string };

type FlowState = Pick<DataFolderStore, 'move' | 'error'>;

export function dataFolderSheet(
  { move, error }: FlowState,
  step: DataFolderStep,
): DataFolderSheet {
  if (step.kind === 'closed') return { kind: 'none' };
  if (move !== null && moveUnderWay(move)) {
    return step.kind === 'stopAsk' && !move.switched
      ? { kind: 'stopAsk', move }
      : { kind: 'moving', move };
  }
  if (move !== null) {
    return { kind: 'paused', move, error: error ?? move.error };
  }
  if (error !== null) return { kind: 'failed', error };
  if (step.kind === 'confirm') return { kind: 'confirm', target: step.target };
  return { kind: 'chooser' };
}

const ACTIONS: Readonly<
  Record<
    DataFolderSheet['kind'],
    readonly (readonly [DataFolderAction, boolean])[]
  >
> = {
  none: [],
  chooser: [],
  confirm: [
    ['backToChooser', false],
    ['move', true],
  ],
  moving: [['askStop', false]],
  stopAsk: [
    ['stop', false],
    ['keepMoving', true],
  ],
  paused: [
    ['undo', false],
    ['resume', true],
  ],
  failed: [
    ['ok', false],
    ['chooseAnother', true],
  ],
};

export function sheetActions(
  sheet: DataFolderSheet,
  pending: boolean,
): readonly SheetAction[] {
  const canCancel = sheet.kind !== 'moving' || !sheet.move.switched;
  return ACTIONS[sheet.kind]
    .filter(([id]) => id !== 'askStop' || canCancel)
    .map(([id, primary]) => ({ id, primary, disabled: pending }));
}

export function settledOutcome(
  finished: MoveFinished,
  outcomes: { readonly failed: string; readonly refused: string },
): boolean {
  return (
    finished.outcome !== outcomes.failed &&
    finished.outcome !== outcomes.refused
  );
}
