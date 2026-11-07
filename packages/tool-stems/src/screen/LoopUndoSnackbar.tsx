import { Snackbar, stemSections } from '@kitbag/core-design';
import { useStemPlayer } from '@kitbag/core-state';
import { useCallback } from 'react';

import { undoMessage } from '../logic/sectionView.ts';

export function LoopUndoSnackbar() {
  const undoableLoop = useStemPlayer((s) => s.undoableLoop);
  const loop = useStemPlayer((s) => s.loop);
  const undoLoop = useStemPlayer((s) => s.undoLoop);
  const dismissLoopUndo = useStemPlayer((s) => s.dismissLoopUndo);
  const onUndo = useCallback(() => {
    void undoLoop();
  }, [undoLoop]);
  if (undoableLoop === null) return null;
  return (
    <Snackbar
      key={`${String(undoableLoop.startSec)}-${String(undoableLoop.endSec)}`}
      message={undoMessage(loop)}
      actionLabel="Undo"
      bottom={stemSections.undoAbove}
      onAction={onUndo}
      onTimeout={dismissLoopUndo}
    />
  );
}
