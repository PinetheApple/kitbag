import {
  Button,
  SectionHeader,
  SegmentedControl,
  Sheet,
  SheetHint,
  snackbar,
  Snackbar,
  space,
} from '@kitbag/core-design';
import { useSongPlayer, type TempoCorrection } from '@kitbag/core-state';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  detectedTempoHint,
  TEMPO_CORRECTION_COPY,
  tempoCorrectionOptions,
} from '../logic/tempoCorrectionText.ts';
import { NoteAnchor } from './NoteAnchor.tsx';
import { useSongTempoCorrection } from './useSongTempoCorrection.ts';

const styles = StyleSheet.create({
  group: { gap: space.controlGap },
});

interface SongTempoCorrectionProps {
  readonly songId: number;
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onClose: () => void;
}

interface PickerProps {
  readonly correction: TempoCorrection;
  readonly onPick: (correction: TempoCorrection) => void;
}

function TempoPicker({ correction, onPick }: PickerProps) {
  const detectedBpm = useSongPlayer((s) => s.detectedBpm);
  const options = useMemo(
    () => tempoCorrectionOptions(detectedBpm),
    [detectedBpm],
  );
  const detected = detectedTempoHint(detectedBpm);
  return (
    <View style={styles.group}>
      <SectionHeader label={TEMPO_CORRECTION_COPY.section} />
      <SegmentedControl
        options={options}
        selected={correction}
        onSelect={onPick}
        accessibilityLabel={TEMPO_CORRECTION_COPY.title}
        size="picker"
      />
      {detected === null ? null : <SheetHint>{detected}</SheetHint>}
      <SheetHint>{TEMPO_CORRECTION_COPY.why}</SheetHint>
    </View>
  );
}

export function SongTempoCorrection({
  songId,
  visible,
  bottomInset,
  onClose,
}: SongTempoCorrectionProps) {
  const { correction, notice, onPick } = useSongTempoCorrection(songId);
  return (
    <>
      <NoteAnchor>
        {visible || notice === null ? null : (
          <Snackbar {...notice} bottom={snackbar.aboveDock} />
        )}
      </NoteAnchor>
      <Sheet
        visible={visible}
        title={TEMPO_CORRECTION_COPY.title}
        dismissLabel={TEMPO_CORRECTION_COPY.close}
        bottomInset={bottomInset}
        notice={notice === null ? undefined : <Snackbar inline {...notice} />}
        onDismiss={onClose}
      >
        <TempoPicker correction={correction} onPick={onPick} />
        <Button
          label={TEMPO_CORRECTION_COPY.done}
          size="target"
          fill
          onPress={onClose}
        />
      </Sheet>
    </>
  );
}
