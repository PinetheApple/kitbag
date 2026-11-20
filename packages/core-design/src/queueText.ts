import type { NoticeContent } from './components/useNotice.ts';

export const QUEUE_TEXT = {
  playNext: 'Play next',
  addToQueue: 'Add to queue',
  moveToEnd: 'Move to end of queue',
  addToSetlist: 'Add to setlist',
  movedToPlayNext: 'Moved to play next',
  movedToEnd: 'Moved to end of queue',
  open: 'Open',
  leaveSetlist: 'Leave setlist',
  undo: 'Undo',
  queue: 'Queue',
  nowPlaying: 'Now playing',
  nextInQueue: 'Next in queue',
  clearQueue: 'Clear queue',
  playQueue: 'Play queue',
  done: 'Done',
  closeQueue: 'Close the queue',
  nothingQueued: 'Nothing queued',
  nothingQueuedReason:
    'Use Play next or Add to queue on a song. When this song ends, playback stops.',
  remove: 'Remove',
} as const;

export function nextFromLabel(setlistName: string): string {
  return `Next from: ${setlistName}`;
}

export function upNextCountLabel(count: number): string {
  return `· ${String(count)} up next`;
}

export function queueKeyLabel(count: number): string {
  return count === 0
    ? QUEUE_TEXT.queue
    : `${QUEUE_TEXT.queue}, ${String(count)} up next`;
}

export function removeFromQueueLabel(title: string): string {
  return `Remove ${title} from the queue`;
}

export const PLAYING = 'Playing';

export function placeLabel(number: number, of: number): string {
  return `${String(number)} of ${String(of)}`;
}

export interface SetlistPlaceText {
  readonly setlistName: string;
  readonly number: number;
  readonly of: number;
}

export function setlistPlaceParts(spot: SetlistPlaceText): string[] {
  return [spot.setlistName, placeLabel(spot.number, spot.of)];
}

export function nextUpLabel(title: string): string {
  return `Next: ${title}`;
}

export const QUEUE_VERB = {
  playNext: 'playNext',
  addToQueue: 'addToQueue',
} as const;

export type QueueVerb = (typeof QUEUE_VERB)[keyof typeof QUEUE_VERB];

export function queueNoticeMessage(
  verb: QueueVerb,
  title: string,
  wasQueued: boolean,
): string {
  if (verb === QUEUE_VERB.playNext)
    return wasQueued ? QUEUE_TEXT.movedToPlayNext : `${title} plays next`;
  return wasQueued ? QUEUE_TEXT.movedToEnd : `Added to queue: ${title}`;
}

export function queueNotice(
  verb: QueueVerb,
  title: string,
  wasQueued: boolean,
  onOpenQueue: (() => void) | null,
): NoticeContent {
  const message = queueNoticeMessage(verb, title, wasQueued);
  if (wasQueued || onOpenQueue === null) return { message };
  return { message, action: { label: QUEUE_TEXT.open, onPress: onOpenQueue } };
}

export function leftSetlistNotice(
  setlistName: string,
  onUndo: () => void,
): NoticeContent {
  return {
    message: `Left ${setlistName}`,
    action: { label: QUEUE_TEXT.undo, onPress: onUndo },
  };
}
