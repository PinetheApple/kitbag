import { useCallback, useState } from 'react';

import { PlayerScreen, type StemPlayerScreenProps } from './PlayerScreen.tsx';

export type { StemPlayerScreenProps } from './PlayerScreen.tsx';

export function StemPlayerScreen(props: StemPlayerScreenProps) {
  const { setId, onOpenStemSet } = props;
  const [reopenCount, setReopenCount] = useState(0);
  const open = useCallback(
    (stemSetId: number) => {
      if (stemSetId === setId) setReopenCount((count) => count + 1);
      else onOpenStemSet(stemSetId);
    },
    [setId, onOpenStemSet],
  );
  return <PlayerScreen key={reopenCount} {...props} onOpenStemSet={open} />;
}
