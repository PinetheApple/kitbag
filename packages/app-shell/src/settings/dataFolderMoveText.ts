import type {
  DataFolderCodes,
  MoveErrors,
  MoveFinished,
  MoveStatus,
} from '@kitbag/core-native';

import { formatBytes } from './bytes.ts';
import {
  capitalised,
  fileCount,
  movePercent,
  placeName,
  thePlace,
} from './dataFolderText.ts';

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

export function undoneText(source: string | null): string {
  return `Move undone. Your files are still on ${thePlace(source)}.`;
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
