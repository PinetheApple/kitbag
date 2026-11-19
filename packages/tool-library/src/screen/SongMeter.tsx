import {
  meterCopy,
  MeterSheet,
  snackbar,
  Snackbar,
  type PlayerFrame,
} from '@kitbag/core-design';
import { GRID_METERS, useSongPlayer } from '@kitbag/core-state';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { lockBadgeOf } from '../logic/lockText.ts';
import {
  METER_FAILED,
  meterGridState,
  reanalysedText,
} from '../logic/songMeterText.ts';
import { useSongMeter } from './useSongMeter.ts';

const styles = StyleSheet.create({
  noteAnchor: { height: 0 },
});

interface SongMeterProps {
  readonly songId: number;
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly playheadSeconds: PlayerFrame['progress'];
  readonly onClose: () => void;
}

function ReanalysedNotice({
  onUseDetected,
}: {
  readonly onUseDetected: () => void;
}) {
  const notice = useSongPlayer((s) => s.meterNotice);
  const override = useSongPlayer((s) => s.meterOverride);
  const dismiss = useSongPlayer((s) => s.dismissMeterNotice);
  const useDetected = useCallback(() => {
    dismiss();
    onUseDetected();
  }, [dismiss, onUseDetected]);
  if (notice === null) return null;
  return (
    <Snackbar
      message={reanalysedText(notice, override)}
      actionLabel={meterCopy.useDetected}
      bottom={snackbar.aboveDock}
      onAction={useDetected}
      onTimeout={dismiss}
    />
  );
}

export function SongMeter({
  songId,
  visible,
  bottomInset,
  playheadSeconds,
  onClose,
}: SongMeterProps) {
  const meter = useSongMeter(songId);
  const detected = useSongPlayer((s) => s.detected);
  const state = meterGridState(useSongPlayer(lockBadgeOf));
  const { notice } = meter;
  return (
    <>
      <View style={styles.noteAnchor}>
        {!visible && notice !== null ? (
          <Snackbar {...notice} bottom={snackbar.aboveDock} />
        ) : (
          <ReanalysedNotice onUseDetected={meter.onReset} />
        )}
      </View>
      <MeterSheet
        visible={visible}
        options={GRID_METERS}
        detectedMeter={detected.meter}
        detectedBarOneSeconds={detected.barOneSeconds}
        override={meter.override}
        playheadSeconds={playheadSeconds}
        state={state}
        failedReason={METER_FAILED}
        notice={notice}
        bottomInset={bottomInset}
        onPickMeter={meter.onPickMeter}
        onBarOneHere={meter.onBarOneHere}
        onReset={meter.onReset}
        onClose={onClose}
      />
    </>
  );
}
