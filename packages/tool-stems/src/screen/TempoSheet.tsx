import {
  createThemedStyles,
  size,
  TempoModeRow,
  TempoModeSheet,
} from '@kitbag/core-design';
import {
  tempoModeLabel,
  tempoSheetView,
  tempoUnavailable,
  useLiveStemPlayer,
  useStemPlayer,
  useStemViewing,
  viewOnlyReason,
  type TempoMode,
} from '@kitbag/core-state';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';

const useStyles = createThemedStyles((theme) => ({
  divided: {
    borderBottomWidth: size.stroke,
    borderBottomColor: theme.color.line,
  },
}));

export function TempoRow({ onOpen }: { readonly onOpen: () => void }) {
  const styles = useStyles();
  const unavailable = useStemPlayer((s) => tempoUnavailable(s.tempo, 'stems'));
  const reason = viewOnlyReason(unavailable, useStemViewing());
  const mode = useStemPlayer((s) => s.tempoMode);
  return (
    <View style={styles.divided}>
      <TempoModeRow
        value={tempoModeLabel(mode)}
        reason={reason}
        onPress={onOpen}
      />
    </View>
  );
}

export interface TempoSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onClose: () => void;
}

export function TempoSheet({ visible, bottomInset, onClose }: TempoSheetProps) {
  const tempo = useStemPlayer((s) => s.tempo);
  const mode = useStemPlayer((s) => s.tempoMode);
  const setTempoMode = useLiveStemPlayer((s) => s.setTempoMode);
  const view = useMemo(
    () => tempoSheetView(tempo, mode, 'stems'),
    [tempo, mode],
  );
  const pick = useCallback(
    (picked: TempoMode) => {
      void setTempoMode(picked);
    },
    [setTempoMode],
  );
  return (
    <TempoModeSheet
      visible={visible}
      bottomInset={bottomInset}
      {...view}
      selected={mode}
      onSelect={pick}
      onClose={onClose}
    />
  );
}
