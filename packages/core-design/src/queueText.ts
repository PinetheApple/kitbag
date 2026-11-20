import type { NoticeContent } from './components/useNotice.ts';

export const QUEUE_TEXT = {
  playNext: 'Play next',
  inUpNext: 'In Up next',
  addToSetlist: 'Add to setlist',
  addedToUpNext: 'Added to Up next',
  openSetlist: 'Open',
  leaveSetlist: 'Leave setlist',
  undo: 'Undo',
} as const;

export function leftSetlistNotice(
  setlistName: string,
  onUndo: () => void,
): NoticeContent {
  return {
    message: `Left ${setlistName}`,
    action: { label: QUEUE_TEXT.undo, onPress: onUndo },
  };
}
