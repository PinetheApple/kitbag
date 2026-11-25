import { useLibrary, useLiveStemPlayer } from '@kitbag/core-state';
import { useCallback, useState } from 'react';

import { PlayerScreen, type StemPlayerScreenProps } from './PlayerScreen.tsx';

export type { StemPlayerScreenProps } from './PlayerScreen.tsx';

function useDisplacedByMetronomeSong(focused: boolean): boolean {
  const loads = useLibrary((s) => s.songLoads);
  const [seen, setSeen] = useState({ loads, focused });
  // Treats a load in the blurring render as made in front: holds only while songs
  // load from presses, never from a covering screen's mount effect.
  if (focused || seen.focused) {
    if (seen.loads !== loads || seen.focused !== focused)
      setSeen({ loads, focused });
    return false;
  }
  return seen.loads !== loads;
}

export function StemPlayerScreen(props: StemPlayerScreenProps) {
  const { setId, focused, onOpenStemSet } = props;
  const [reopenCount, setReopenCount] = useState(0);
  const displaced = useDisplacedByMetronomeSong(focused);
  const close = useLiveStemPlayer((s) => s.close);
  const open = useCallback(
    (stemSetId: number) => {
      if (stemSetId !== setId) {
        onOpenStemSet(stemSetId);
        return;
      }
      close();
      setReopenCount((count) => count + 1);
    },
    [setId, onOpenStemSet, close],
  );
  // The metronome song took the stage; remounting on Back reopens this song.
  if (displaced) return null;
  return <PlayerScreen key={reopenCount} {...props} onOpenStemSet={open} />;
}
