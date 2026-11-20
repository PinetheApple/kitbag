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
} as const;

export const PLAYING = 'Playing';

export function placeLabel(number: number, of: number): string {
  return `${String(number)} of ${String(of)}`;
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
