export const QUEUE_TEXT = {
  playNext: 'Play next',
  inUpNext: 'In Up next',
  addToSetlist: 'Add to setlist',
  addedToUpNext: 'Added to Up next',
  openSetlist: 'Open',
  leaveSetlist: 'Leave setlist',
  undo: 'Undo',
} as const;

export function leftSetlistText(setlistName: string): string {
  return `Left ${setlistName}`;
}
