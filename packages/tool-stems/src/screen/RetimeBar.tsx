import {
  AppBar,
  BarIconButton,
  Button,
  createThemedStyles,
  onHardwareBack,
  stemSections,
  type NeighbourGaps,
} from '@kitbag/core-design';
import { useStemPlayer } from '@kitbag/core-state';
import { useCallback, useEffect } from 'react';
import { View } from 'react-native';

import {
  leaveRetimeBody,
  retimeSubtitle,
  retimeUnsaved,
} from '../logic/retimeView.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';

const NO_NEIGHBOUR_CONTROLS: NeighbourGaps = {};

const useStyles = createThemedStyles(() => ({
  saveSlot: { marginRight: stemSections.saveEnd },
}));

interface RetimeBarProps {
  readonly onAskReset: () => void;
  readonly onAskLeave: () => void;
}

export function RetimeBar({ onAskReset, onAskLeave }: RetimeBarProps) {
  const styles = useStyles();
  const lines = useStemPlayer((s) => s.lyrics.lines);
  const retime = useStemPlayer((s) => s.retime);
  const retimed = useStemPlayer((s) => s.lyrics.retimed);
  const cancelRetime = useStemPlayer((s) => s.cancelRetime);
  const commitRetime = useStemPlayer((s) => s.commitRetime);
  const unsaved = retimeUnsaved(retime);
  const close = useCallback(() => {
    if (unsaved) onAskLeave();
    else cancelRetime();
  }, [unsaved, onAskLeave, cancelRetime]);
  useEffect(() => onHardwareBack(close), [close]);
  const save = useCallback(() => {
    void commitRetime();
  }, [commitRetime]);
  if (retime.kind !== 'recording') return null;
  const canReset = retimed || unsaved;
  return (
    <AppBar
      flush
      title="Retime lyrics"
      subtitle={retimeSubtitle(lines, retime.nextLine, retime.playbackRate)}
      closeLabel="Close retime"
      onClose={close}
      trailing={
        <>
          <BarIconButton
            icon="reset"
            label="Reset to bundle timing"
            disabled={!canReset}
            onPress={onAskReset}
          />
          <View style={styles.saveSlot}>
            <Button
              size="bar"
              variant="primary"
              label="Save"
              neighbourGapDp={NO_NEIGHBOUR_CONTROLS}
              onPress={save}
            />
          </View>
        </>
      }
    />
  );
}

export function ResetDialog({ onClose }: { readonly onClose: () => void }) {
  const resetRetime = useStemPlayer((s) => s.resetRetime);
  const confirm = useCallback(() => {
    onClose();
    void resetRetime();
  }, [onClose, resetRetime]);
  return (
    <ConfirmDialog
      title="Reset to bundle timing?"
      body="Your taps and offset for this song are dropped. Lyrics go back to the timing that came in the bundle."
      cancelLabel="Cancel"
      confirmLabel="Reset"
      onConfirm={confirm}
      onCancel={onClose}
    />
  );
}

export function LeaveDialog({ onClose }: { readonly onClose: () => void }) {
  const retime = useStemPlayer((s) => s.retime);
  const cancelRetime = useStemPlayer((s) => s.cancelRetime);
  const leave = useCallback(() => {
    onClose();
    cancelRetime();
  }, [onClose, cancelRetime]);
  if (retime.kind !== 'recording') return null;
  return (
    <ConfirmDialog
      title="Leave without saving?"
      body={leaveRetimeBody(retime.taps.length, retime.shiftSteps)}
      cancelLabel="Keep tapping"
      confirmLabel="Leave"
      onConfirm={leave}
      onCancel={onClose}
    />
  );
}
