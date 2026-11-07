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

import { retimeLineLabel } from '../logic/retimeView.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';

const NO_NEIGHBOUR_CONTROLS: NeighbourGaps = {};

const useStyles = createThemedStyles(() => ({
  saveSlot: { marginRight: stemSections.saveEnd },
}));

export function RetimeBar({ onAskReset }: { readonly onAskReset: () => void }) {
  const styles = useStyles();
  const lines = useStemPlayer((s) => s.lyrics.lines);
  const retime = useStemPlayer((s) => s.retime);
  const retimed = useStemPlayer((s) => s.lyrics.retimed);
  const cancelRetime = useStemPlayer((s) => s.cancelRetime);
  const commitRetime = useStemPlayer((s) => s.commitRetime);
  useEffect(() => onHardwareBack(cancelRetime), [cancelRetime]);
  const save = useCallback(() => {
    void commitRetime();
  }, [commitRetime]);
  if (retime.kind !== 'recording') return null;
  const canReset = retimed || retime.taps.length > 0 || retime.shiftSteps !== 0;
  return (
    <AppBar
      flush
      title="Retime lyrics"
      subtitle={retimeLineLabel(lines, retime.nextLine)}
      closeLabel="Close retime"
      onClose={cancelRetime}
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
      confirmLabel="Reset"
      onConfirm={confirm}
      onCancel={onClose}
    />
  );
}
