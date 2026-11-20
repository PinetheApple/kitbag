import { useLibrary, useStemPlayer } from '@kitbag/core-state';
import { useCallback, useLayoutEffect, useState } from 'react';

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
  const close = useStemPlayer((s) => s.close);
  const showsThisSong = useStemPlayer((s) => s.setId === setId);
  useLayoutEffect(() => {
    if (displaced && showsThisSong) close();
  }, [displaced, showsThisSong, close]);
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
  // The metronome song now owns the stage, and a ready song outlives its screen.
  if (displaced) return null;
  return <PlayerScreen key={reopenCount} {...props} onOpenStemSet={open} />;
}
