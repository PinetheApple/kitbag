import { countLabel } from '@kitbag/core-design';
import type {
  DataFolderCodes,
  DataFolderVolume,
  DataFolderVolumes,
  MoveErrors,
  MoveFinished,
  MoveStatus,
} from '@kitbag/core-native';

import { formatBytes, formatSpace } from './bytes.ts';
import { SEPARATOR } from './separator.ts';

export const DATA_FOLDER_LABEL = 'Data folder';
export const INTERNAL_STORAGE = 'Internal storage';
export const IN_USE = 'IN USE';
export const LOCATION_LABEL = 'Location';
export const CHOOSER_HINT =
  'Song audio, stems and waveforms live here. Your song list, setlists and settings stay on the phone.';
export const NO_CARD_HINT = 'Put a portable SD card in to move songs onto it.';
export const CONFIRM_HINTS = [
  'Only song audio, stems and waveforms move. Your song list, setlists and settings stay on the phone.',
  'You can keep playing while files move, and cancel until the files switch over. If you take the card out later, songs on it won’t play until it’s back.',
] as const;
export const MOVING_CLOSE_HINT =
  'Close this and keep using Kitbag. The move carries on, and this row shows how it is going.';
export const STOP_TITLE = 'Stop moving?';
export const MOVE = 'Move';
export const CANCEL = 'Cancel';
export const CANCEL_MOVE = 'Cancel move';
export const KEEP_MOVING = 'Keep moving';
export const STOP_MOVING = 'Stop moving';
export const RESUME = 'Resume';
export const TRY_AGAIN = 'Try again';
export const UNDO = 'Undo';
export const OK = 'OK';
export const CHOOSE_ANOTHER = 'Choose another place';
export const CLOSE_DATA_FOLDER = 'Close data folder';

const INTERNAL_PLACE = 'internal storage';
const CARD_PLACE = 'SD card';
const THE_CARD = 'the SD card';
const PERCENT = 100;

export function placeName(volumeUuid: string | null): string {
  return volumeUuid === null ? INTERNAL_PLACE : CARD_PLACE;
}

export function thePlace(volumeUuid: string | null): string {
  return volumeUuid === null ? INTERNAL_PLACE : THE_CARD;
}

function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function findVolume(
  volumes: DataFolderVolumes,
  volumeUuid: string | null,
): DataFolderVolume | undefined {
  return volumes.volumes.find((volume) => volume.volumeUuid === volumeUuid);
}

export function volumeName(
  volume: Pick<DataFolderVolume, 'volumeUuid' | 'name'> | undefined,
  volumeUuid: string | null = volume?.volumeUuid ?? null,
): string {
  if (volumeUuid === null) return INTERNAL_STORAGE;
  return volume?.name ?? capitalised(CARD_PLACE);
}

export function movePercent(move: MoveStatus): number {
  return move.totalBytes > 0
    ? Math.round((move.doneBytes / move.totalBytes) * PERCENT)
    : 0;
}

const percentDetail = (move: MoveStatus) =>
  `${SEPARATOR} ${String(movePercent(move))}%`;

export function moveUnderWay(move: MoveStatus): boolean {
  return move.running || move.switched;
}

export interface RowValue {
  readonly lead: string;
  readonly detail: string | null;
  readonly missing: boolean;
  readonly highlighted: boolean;
}

export function dataFolderRowValue(
  volumes: DataFolderVolumes,
  move: MoveStatus | null,
): RowValue {
  const quiet = { missing: false, highlighted: false };
  if (move !== null && moveUnderWay(move)) {
    return {
      lead: `Moving to ${placeName(move.targetVolumeUuid)}`,
      detail: percentDetail(move),
      missing: false,
      highlighted: true,
    };
  }
  if (move !== null) {
    return {
      ...quiet,
      lead: `Move to ${placeName(move.targetVolumeUuid)} paused`,
      detail: null,
    };
  }
  const current = findVolume(volumes, volumes.currentVolumeUuid);
  const name = volumeName(current, volumes.currentVolumeUuid);
  if (!volumes.currentAvailable) {
    return {
      lead: `${name} ${SEPARATOR} not found`,
      detail: null,
      missing: true,
      highlighted: false,
    };
  }
  return {
    ...quiet,
    lead: name,
    detail:
      current === undefined
        ? null
        : `${SEPARATOR} ${formatSpace(current.freeBytes)} free`,
  };
}

export function rowValueLabel({ lead, detail }: RowValue): string {
  return detail === null ? lead : `${lead} ${detail}`;
}

export interface LocationValue {
  readonly volume: string;
  readonly moving: string | null;
}

export function locationValue(
  volumes: DataFolderVolumes,
  move: MoveStatus | null,
): LocationValue {
  const volume = volumeName(
    findVolume(volumes, volumes.currentVolumeUuid),
    volumes.currentVolumeUuid,
  );
  return {
    volume,
    moving:
      move?.running === true && !move.switched
        ? `→ ${placeName(move.targetVolumeUuid)} ${percentDetail(move)}`
        : null,
  };
}

export interface MediaSize {
  readonly bytes: number;
  readonly files: number;
}

export interface VolumeOption {
  readonly volumeUuid: string | null;
  readonly name: string;
  readonly sub: string;
  readonly inUse: boolean;
  readonly offered: boolean;
  readonly shortBy: number | null;
}

const fileCount = (count: number) => countLabel(count, 'file', 'files');

function freeLine(volume: DataFolderVolume): string {
  return `${formatSpace(volume.freeBytes)} free`;
}

function blockedLine(
  volume: DataFolderVolume,
  volumes: DataFolderVolumes,
  codes: DataFolderCodes,
): string | null {
  if (volume.state === codes.volumeStates.readOnly) {
    return 'Read-only. Kitbag can’t write to this card.';
  }
  if (volume.state === codes.volumeStates.unmounted) {
    return 'Not mounted. Put the card back to use it.';
  }
  if (volumes.requiredBytes === null) {
    return `Kitbag can’t read the current folder, so nothing can move.`;
  }
  if (volume.freeBytes < volumes.requiredBytes) {
    return `${freeLine(volume)} ${SEPARATOR} needs ${formatBytes(volumes.requiredBytes)}`;
  }
  return null;
}

export function volumeOption(
  volume: DataFolderVolume,
  volumes: DataFolderVolumes,
  codes: DataFolderCodes,
  media: MediaSize | null,
): VolumeOption {
  const base = {
    volumeUuid: volume.volumeUuid,
    name: volumeName(volume),
    inUse: volume.inUse,
  };
  if (volume.inUse) {
    const used =
      media === null ? '' : ` ${SEPARATOR} ${formatBytes(media.bytes)} used`;
    return {
      ...base,
      sub: `${freeLine(volume)}${used}`,
      offered: false,
      shortBy: null,
    };
  }
  const blocked = blockedLine(volume, volumes, codes);
  const required = volumes.requiredBytes;
  const short =
    required !== null &&
    volume.state === codes.volumeStates.mounted &&
    volume.freeBytes < required
      ? required - volume.freeBytes
      : null;
  return {
    ...base,
    sub: blocked ?? freeLine(volume),
    offered: blocked === null,
    shortBy: short,
  };
}

export function noSpaceHint(option: VolumeOption): string | null {
  if (option.shortBy === null) return null;
  return `Free up ${formatBytes(option.shortBy)} on ${thePlace(option.volumeUuid)} to move here. Nothing has moved.`;
}

export function confirmTitle(target: string | null): string {
  return `Move to ${placeName(target)}?`;
}

export function mediaText(media: MediaSize): string {
  return `${formatBytes(media.bytes)} ${SEPARATOR} ${fileCount(media.files)}`;
}

export function freeAfterLabel(target: string | null): string {
  return `Free on ${thePlace(target)} after`;
}

export function freeAfterText(volume: DataFolderVolume, media: MediaSize) {
  return formatSpace(Math.max(0, volume.freeBytes - media.bytes));
}

export function movingTitle(move: MoveStatus): string {
  return `Moving to ${placeName(move.targetVolumeUuid)}`;
}

export function progressBytes(move: MoveStatus): readonly [string, string] {
  return [formatBytes(move.doneBytes), `of ${formatBytes(move.totalBytes)}`];
}

export function progressFiles(move: MoveStatus): readonly [string, string] {
  return [String(move.doneFiles), `of ${fileCount(move.totalFiles)}`];
}

export function progressLabel(move: MoveStatus): string {
  return `${movingTitle(move)}, ${String(movePercent(move))}%`;
}

const PHASE_TEXT = [
  'Checking there is room and that Kitbag can write there.',
  'Copying files.',
  'Checking every copy against its original.',
  'Copying songs added during the move.',
  'Switched over.',
  'Removing the old copies.',
  'Done.',
] as const;

export function phaseText(phase: string, codes: DataFolderCodes): string {
  return PHASE_TEXT[codes.movePhases.indexOf(phase)] ?? PHASE_TEXT[1];
}

export function movingHint(move: MoveStatus): string {
  if (move.switched) {
    return `Your songs now play from ${thePlace(move.targetVolumeUuid)}. The old copies are removed once nothing is playing from them.`;
  }
  return `Every song keeps playing from ${thePlace(move.sourceVolumeUuid)} until the move finishes.`;
}

export function stopHint(move: MoveStatus): string {
  return `The ${fileCount(move.doneFiles)} already copied are removed from ${thePlace(move.targetVolumeUuid)}. Everything stays on ${thePlace(move.sourceVolumeUuid)}, where it is now.`;
}

export function pausedTitle(move: MoveStatus): string {
  return `Move to ${placeName(move.targetVolumeUuid)} paused`;
}

export function pausedHint(move: MoveStatus): string {
  return `Kitbag closed during the move. ${String(move.doneFiles)} of ${fileCount(move.totalFiles)} are on ${thePlace(move.targetVolumeUuid)}. Your songs still play from ${thePlace(move.sourceVolumeUuid)}.`;
}

export interface Places {
  readonly source: string | null;
  readonly target: string | null;
}

export interface ErrorText {
  readonly title: string;
  readonly body: string;
}

type ErrorCopy = (from: string, to: string, toName: string) => ErrorText;

const MOVE_ERROR_TEXT: Readonly<Record<keyof MoveErrors, ErrorCopy>> = {
  sourceUnavailable: (from) => ({
    title: `Can’t reach ${from}`,
    body: `Your files are on ${from} and Kitbag can’t read it right now. Nothing was moved. Put it back and try again.`,
  }),
  targetUnavailable: (from, to) => ({
    title: `${capitalised(to)} went away`,
    body: `Kitbag lost ${to} and stopped before switching. Every song still plays from ${from}.`,
  }),
  targetOccupied: (from, to) => ({
    title: `Kitbag files already on ${to}`,
    body: `${capitalised(to)} has files from an earlier move in the way, and Kitbag won’t copy over them. Your files are still on ${from}.`,
  }),
  noSpace: (from, to) => ({
    title: `Not enough space on ${to}`,
    body: `Free up space on ${to} to move here. Nothing has moved; your files are still on ${from}.`,
  }),
  targetNotWritable: (from, to, toName) => ({
    title: `Can’t write to ${toName}`,
    body: `Kitbag wrote a test file before copying anything, and ${to} refused it. It may be read-only, locked or failing. Nothing was moved. Your files are still on ${from}.`,
  }),
  hashMismatch: (from, to) => ({
    title: 'Move didn’t finish',
    body: `Some files on ${to} didn’t match the originals, so Kitbag stopped before switching. Nothing is lost. Every song still plays from ${from}. Trying again copies them afresh; if it fails again the card may be failing.`,
  }),
  targetLeftovers: (from, to) => ({
    title: `Old copies still on ${to}`,
    body: `Kitbag is still removing copies from an earlier move on ${to}. Nothing was moved; your files are still on ${from}. Try again in a moment.`,
  }),
  stateUnreadable: () => ({
    title: 'Can’t read the last move',
    body: 'Kitbag couldn’t read how far the last move got, so it changed nothing. Your files are where they were.',
  }),
  io: (from) => ({
    title: 'Move stopped',
    body: `Kitbag couldn’t read or write a file, so it stopped before switching. Every song still plays from ${from}.`,
  }),
  sameLocation: (from) => ({
    title: 'Already there',
    body: `Your files are already on ${from}.`,
  }),
  inProgress: () => ({
    title: 'A move is already under way',
    body: 'Finish or undo the move in progress first.',
  }),
  noMove: () => ({
    title: 'Nothing to move',
    body: 'There is no move to resume or stop.',
  }),
  running: () => ({
    title: 'The move is still running',
    body: 'Wait for it to stop, then undo it.',
  }),
  switched: (from, to) => ({
    title: 'Too late to cancel',
    body: `Your files have already switched to ${to}. The copies on ${from} are removed once nothing is playing from them.`,
  }),
  notOnCard: () => ({
    title: 'Already on internal storage',
    body: 'The data folder isn’t on a card, so there is nothing to switch.',
  }),
  cardMounted: (from) => ({
    title: 'The card is back',
    body: `${capitalised(from)} is in again, so its songs play from it. Nothing was switched.`,
  }),
  importLockHeld: () => ({
    title: 'A song is still importing',
    body: 'Try again once the import has finished.',
  }),
  foregroundRefused: () => ({
    title: 'The move couldn’t start',
    body: 'Android only lets a move start while Kitbag is on screen. Open Kitbag and try again.',
  }),
};

export function moveErrorText(
  code: string,
  codes: DataFolderCodes,
  places: Places,
): ErrorText {
  const keys = Object.keys(MOVE_ERROR_TEXT) as (keyof MoveErrors)[];
  const key = keys.find((name) => codes.moveErrors[name] === code) ?? 'io';
  return MOVE_ERROR_TEXT[key](
    thePlace(places.source),
    thePlace(places.target),
    placeName(places.target),
  );
}

export function outcomeText(
  finished: MoveFinished,
  codes: DataFolderCodes,
  current: string | null,
): string | null {
  const { moveOutcomes: outcomes } = codes;
  switch (finished.outcome) {
    case outcomes.done:
      return `Move finished. Your files are on ${thePlace(current)}.`;
    case outcomes.cancelled:
      return `Move stopped. Your files are still on ${thePlace(current)}.`;
    case outcomes.awaitingRelease:
      return `Files moved to ${thePlace(current)}. The old copies are removed once nothing is playing from them.`;
    case outcomes.cleanupDeferred:
      return `Files moved to ${thePlace(current)}. The old copies are removed when the card is back.`;
    default:
      return null;
  }
}
