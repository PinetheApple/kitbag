import { countLabel } from './countLabel.ts';
import type { NoticeContent } from './components/useNotice.ts';
import { QUEUE_TEXT } from './queueText.ts';
import { FACT_SEPARATOR } from './separator.ts';

export interface AddedToSetlist {
  readonly setlistId: number;
  readonly name: string;
}

export interface SetlistPick {
  readonly id: number;
  readonly name: string;
  readonly onStage: boolean;
  readonly songCount: number;
  readonly stemCount: number;
  readonly holds: boolean;
}

export function addedToSetlistNotice(
  { setlistId, name }: AddedToSetlist,
  onOpenSetlist: (setlistId: number) => void,
): NoticeContent {
  return {
    message: `Added to ${name}`,
    action: {
      label: QUEUE_TEXT.open,
      onPress: () => {
        onOpenSetlist(setlistId);
      },
    },
  };
}

export function pickerSubtitle(pick: SetlistPick): string {
  const parts = [countLabel(pick.songCount, 'song', 'songs')];
  if (pick.stemCount > 0)
    parts.push(countLabel(pick.stemCount, 'stem song', 'stem songs'));
  if (pick.onStage) parts.push('on stage');
  return parts.join(FACT_SEPARATOR);
}
