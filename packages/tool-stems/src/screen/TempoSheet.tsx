import {
  createThemedStyles,
  size,
  TempoModeRow,
  TempoModeSheet,
} from '@kitbag/core-design';
import {
  constantLine,
  tempoHint,
  tempoModeLabel,
  tempoOptions,
  tempoUnavailable,
  useStemPlayer,
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
  const reason = useStemPlayer((s) => tempoUnavailable(s.tempo, 'stems'));
  const mode = useStemPlayer((s) => s.tempoMode);
  return (
    <View style={styles.divided}>
      <TempoModeRow
        value={mode === null ? '' : tempoModeLabel(mode)}
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
  const setTempoMode = useStemPlayer((s) => s.setTempoMode);
  const options = useMemo(() => tempoOptions(tempo), [tempo]);
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
      options={options}
      selected={mode}
      constantLine={constantLine(tempo)}
      hint={tempo === null || mode === null ? null : tempoHint(tempo, mode)}
      onSelect={pick}
      onClose={onClose}
    />
  );
}
