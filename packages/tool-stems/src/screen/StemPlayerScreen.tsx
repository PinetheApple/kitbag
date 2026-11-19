import { useLibrary } from '@kitbag/core-state';
import { useCallback, useState } from 'react';

import { PlayerScreen, type StemPlayerScreenProps } from './PlayerScreen.tsx';

export type { StemPlayerScreenProps } from './PlayerScreen.tsx';

function useDisplacedByMetronomeSong(focused: boolean): boolean {
  const loads = useLibrary((s) => s.songLoads);
  const [seen, setSeen] = useState(loads);
  if (focused && seen !== loads) setSeen(loads);
  return !focused && seen !== loads;
}

export function StemPlayerScreen(props: StemPlayerScreenProps) {
  const { setId, focused, onOpenStemSet } = props;
  const [reopenCount, setReopenCount] = useState(0);
  const displaced = useDisplacedByMetronomeSong(focused);
  const open = useCallback(
    (stemSetId: number) => {
      if (stemSetId === setId) setReopenCount((count) => count + 1);
      else onOpenStemSet(stemSetId);
    },
    [setId, onOpenStemSet],
  );
  // Unmounting is what lets go of the mixer; the metronome song now owns the stage.
  if (displaced) return null;
  return <PlayerScreen key={reopenCount} {...props} onOpenStemSet={open} />;
}
