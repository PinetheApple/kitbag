import { songShown, stemShown } from '../playOrder/shown.ts';
import { useLiveSongPlayer } from '../songPlayer/useSongPlayer.ts';
import { useLiveStemPlayer } from '../stemPlayer/useStemPlayer.ts';
import { viewPlayLabel } from './viewText.ts';

export function useViewPlayLabel(
  title: string,
  viewing: boolean,
): string | undefined {
  const song = useLiveSongPlayer((s) => (songShown(s) ? s.title : null));
  const stems = useLiveStemPlayer((s) => (stemShown(s) ? s.title : null));
  const playing = song ?? stems;
  return viewing && playing !== null
    ? viewPlayLabel(title, playing)
    : undefined;
}
