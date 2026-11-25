import { Snackbar, snackbar } from '@kitbag/core-design';
import { useLiveStemPlayer } from '@kitbag/core-state';
import { useCallback } from 'react';

import { undoMessage } from '../logic/sectionView.ts';

export function LoopUndoSnackbar() {
  const undoableLoop = useLiveStemPlayer((s) => s.undoableLoop);
  const loop = useLiveStemPlayer((s) => s.loop);
  const undoLoop = useLiveStemPlayer((s) => s.undoLoop);
  const dismissLoopUndo = useLiveStemPlayer((s) => s.dismissLoopUndo);
  const onUndo = useCallback(() => {
    void undoLoop();
  }, [undoLoop]);
  if (undoableLoop === null) return null;
  return (
    <Snackbar
      key={`${String(undoableLoop.startSec)}-${String(undoableLoop.endSec)}`}
      message={undoMessage(loop)}
      actionLabel="Undo"
      bottom={snackbar.aboveDock}
      onAction={onUndo}
      onTimeout={dismissLoopUndo}
    />
  );
}
