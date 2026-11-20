import type {
  DataFolderVolume,
  DataFolderVolumes,
  MoveStatus,
} from '@kitbag/core-native';
import type { DataFolderStore } from '@kitbag/core-state';

export type DataFolderStep =
  | { readonly kind: 'closed' }
  | { readonly kind: 'open' }
  | { readonly kind: 'confirm'; readonly target: string | null }
  | { readonly kind: 'starting'; readonly target: string | null }
  | { readonly kind: 'returnOffer'; readonly volumeUuid: string }
  | { readonly kind: 'returnStarting'; readonly volumeUuid: string }
  | { readonly kind: 'stopAsk' };

export type DataFolderEvent =
  | { readonly kind: 'open' }
  | { readonly kind: 'offerReturn'; readonly volumeUuid: string }
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
  if (event.kind === 'offerReturn')
    return { kind: 'returnOffer', volumeUuid: event.volumeUuid };
  if (event.kind === 'close') return CLOSED;
  if (step.kind === 'closed') return CLOSED;
  switch (event.kind) {
    case 'choose':
      return { kind: 'confirm', target: event.target };
    case 'start':
      return startedFrom(step);
    case 'progressed':
      return step.kind === 'starting' || step.kind === 'returnStarting'
        ? OPEN
        : step;
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

function startedFrom(step: DataFolderStep): DataFolderStep {
  if (step.kind === 'confirm') return { kind: 'starting', target: step.target };
  if (step.kind === 'returnOffer')
    return { kind: 'returnStarting', volumeUuid: step.volumeUuid };
  return step;
}

export type DataFolderAction =
  | 'move'
  | 'returnMove'
  | 'declineReturn'
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
  | {
      readonly kind: 'returnOffer';
      readonly volume: DataFolderVolume;
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
  | { readonly kind: 'failed'; readonly error: string }
  | { readonly kind: 'returnFailed'; readonly error: string };

type FlowState = Pick<DataFolderStore, 'move' | 'error'> & {
  readonly volumes?: DataFolderVolumes | null;
  readonly returning?: boolean;
};

const isReturnStep = (step: DataFolderStep) =>
  step.kind === 'returnOffer' || step.kind === 'returnStarting';

function returnOfferSheet(
  volumes: DataFolderVolumes | null | undefined,
  step: Extract<DataFolderStep, { volumeUuid: string }>,
): DataFolderSheet {
  const volume = volumes?.volumes.find(
    ({ volumeUuid }) => volumeUuid === step.volumeUuid,
  );
  return volume === undefined
    ? { kind: 'none' }
    : { kind: 'returnOffer', volume, starting: step.kind === 'returnStarting' };
}

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
  { move, error, volumes, returning = false }: FlowState,
  step: DataFolderStep,
): DataFolderSheet {
  if (step.kind === 'closed') return { kind: 'none' };
  if (move !== null) return moveSheet(move, error, step);
  if (error !== null)
    return returning || isReturnStep(step)
      ? { kind: 'returnFailed', error }
      : { kind: 'failed', error };
  if (step.kind === 'returnOffer' || step.kind === 'returnStarting')
    return returnOfferSheet(volumes, step);
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
  returnOffer: [
    ['declineReturn', false],
    ['returnMove', true],
  ],
  returnFailed: [['ok', true]],
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
  const starting =
    (sheet.kind === 'confirm' || sheet.kind === 'returnOffer') &&
    sheet.starting;
  return ACTIONS[sheet.kind].map(([id, primary]) => ({
    id,
    primary,
    disabled: pending || starting,
  }));
}
