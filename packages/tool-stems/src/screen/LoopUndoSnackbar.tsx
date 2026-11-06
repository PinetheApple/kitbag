import { Snackbar, stemSections } from '@kitbag/core-design';
import { useStemPlayer, type LoopSeconds } from '@kitbag/core-state';
import { useCallback, useState } from 'react';

import { undoMessage } from '../logic/sectionView.ts';

export function LoopUndoSnackbar() {
  const savedLoop = useStemPlayer((s) => s.savedLoop);
  const loop = useStemPlayer((s) => s.loop);
  const undoLoop = useStemPlayer((s) => s.undoLoop);
  const [timedOut, setTimedOut] = useState<LoopSeconds | null>(null);
  const onTimeout = useCallback(() => {
    setTimedOut(savedLoop);
  }, [savedLoop]);
  const onUndo = useCallback(() => {
    void undoLoop();
  }, [undoLoop]);
  if (savedLoop === null || savedLoop === timedOut) return null;
  return (
    <Snackbar
      message={undoMessage(loop)}
      actionLabel="Undo"
      bottom={stemSections.undoAbove}
      onAction={onUndo}
      onTimeout={onTimeout}
    />
  );
}
