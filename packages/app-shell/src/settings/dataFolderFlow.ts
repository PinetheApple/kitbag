import type { MoveStatus } from '@kitbag/core-native';
import type { DataFolderStore } from '@kitbag/core-state';

export type DataFolderStep =
  | { readonly kind: 'closed' }
  | { readonly kind: 'open' }
  | { readonly kind: 'confirm'; readonly target: string | null }
  | { readonly kind: 'starting'; readonly target: string | null }
  | { readonly kind: 'stopAsk' };

export type DataFolderEvent =
  | { readonly kind: 'open' }
  | { readonly kind: 'choose'; readonly target: string | null }
  | { readonly kind: 'start' }
  | { readonly kind: 'progressed' }
  | { readonly kind: 'back' }
  | { readonly kind: 'askStop' }
  | { readonly kind: 'keepMoving' }
  | { readonly kind: 'requestSettled' }
  | { readonly kind: 'finished'; readonly settled: boolean }
  | { readonly kind: 'close' };

export const CLOSED: DataFolderStep = { kind: 'closed' };

const OPEN: DataFolderStep = { kind: 'open' };

export function nextDataFolderStep(
  step: DataFolderStep,
  event: DataFolderEvent,
): DataFolderStep {
  if (event.kind === 'open') return OPEN;
  if (event.kind === 'close') return CLOSED;
  if (step.kind === 'closed') return CLOSED;
  switch (event.kind) {
    case 'choose':
      return { kind: 'confirm', target: event.target };
    case 'start':
      return step.kind === 'confirm'
        ? { kind: 'starting', target: step.target }
        : step;
    case 'progressed':
      return step.kind === 'starting' ? OPEN : step;
    case 'back':
    case 'keepMoving':
    case 'requestSettled':
      return OPEN;
    case 'askStop':
      return { kind: 'stopAsk' };
    case 'finished':
      return event.settled ? CLOSED : OPEN;
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
  | 'notNow'
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
  | {
      readonly kind: 'confirm';
      readonly target: string | null;
      readonly starting: boolean;
    }
  | { readonly kind: 'moving'; readonly move: MoveStatus }
  | { readonly kind: 'stopAsk'; readonly move: MoveStatus }
  | { readonly kind: 'switched'; readonly move: MoveStatus }
  | { readonly kind: 'switchedFailed'; readonly move: MoveStatus }
  | { readonly kind: 'paused'; readonly move: MoveStatus }
  | {
      readonly kind: 'stopped';
      readonly move: MoveStatus;
      readonly error: string;
    }
  | { readonly kind: 'failed'; readonly error: string };

type FlowState = Pick<DataFolderStore, 'move' | 'error'>;

function moveSheet(
  move: MoveStatus,
  storeError: string | null,
  step: DataFolderStep,
): DataFolderSheet {
  if (move.switched) {
    return !move.running && move.error !== null
      ? { kind: 'switchedFailed', move }
      : { kind: 'switched', move };
  }
  if (move.running) {
    return step.kind === 'stopAsk'
      ? { kind: 'stopAsk', move }
      : { kind: 'moving', move };
  }
  return storeError === null
    ? { kind: 'paused', move }
    : { kind: 'stopped', move, error: storeError };
}

export function dataFolderSheet(
  { move, error }: FlowState,
  step: DataFolderStep,
): DataFolderSheet {
  if (step.kind === 'closed') return { kind: 'none' };
  if (move !== null) return moveSheet(move, error, step);
  if (error !== null) return { kind: 'failed', error };
  if (step.kind === 'confirm' || step.kind === 'starting') {
    return {
      kind: 'confirm',
      target: step.target,
      starting: step.kind === 'starting',
    };
  }
  return { kind: 'chooser' };
}

type ActionSlot = readonly [DataFolderAction, boolean];

const ACTIONS: Readonly<
  Record<DataFolderSheet['kind'], readonly ActionSlot[]>
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
  switched: [],
  switchedFailed: [
    ['ok', false],
    ['resume', true],
  ],
  paused: [
    ['undo', false],
    ['resume', true],
  ],
  stopped: [
    ['notNow', false],
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
  const starting = sheet.kind === 'confirm' && sheet.starting;
  return ACTIONS[sheet.kind].map(([id, primary]) => ({
    id,
    primary,
    disabled: pending || starting,
  }));
}
