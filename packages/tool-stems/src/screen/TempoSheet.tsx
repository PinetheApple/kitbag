import {
  Button,
  createThemedStyles,
  SectionHeader,
  SegmentedControl,
  Sheet,
  space,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import { useStemPlayer, type TempoMode } from '@kitbag/core-state';
import { useCallback, useMemo } from 'react';
import { Text, View } from 'react-native';

import {
  constantLine,
  tempoCopy,
  tempoHint,
  tempoModeLabel,
  tempoOptions,
  tempoUnavailable,
} from '../logic/tempoView.ts';
import { ValueRow } from './ValueRow.tsx';

const useStyles = createThemedStyles((theme) => ({
  group: { gap: space.controlGap },
  hint: { ...textStyle(textRoles.sheetHint), color: theme.color.text2 },
  foot: { flexDirection: 'row', gap: space.controlGap },
}));

export function TempoRow({ onOpen }: { readonly onOpen: () => void }) {
  const reason = useStemPlayer((s) => tempoUnavailable(s.tempo));
  const mode = useStemPlayer((s) => s.tempoMode);
  return (
    <ValueRow
      icon="tempoMode"
      title={tempoCopy.row}
      value={mode === null ? '' : tempoModeLabel(mode)}
      reason={reason}
      onPress={onOpen}
    />
  );
}

function ModeGroup() {
  const styles = useStyles();
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
  const constant = constantLine(tempo);
  return (
    <View style={styles.group}>
      <SectionHeader label={tempoCopy.grid} />
      <SegmentedControl
        size="large"
        options={options}
        selected={mode ?? undefined}
        accessibilityLabel={tempoCopy.row}
        onSelect={pick}
      />
      {constant === null ? null : <Text style={styles.hint}>{constant}</Text>}
      {tempo === null || mode === null ? null : (
        <Text style={styles.hint}>{tempoHint(tempo, mode)}</Text>
      )}
    </View>
  );
}

export interface TempoSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onClose: () => void;
}

export function TempoSheet({ visible, bottomInset, onClose }: TempoSheetProps) {
  const styles = useStyles();
  return (
    <Sheet
      visible={visible}
      title={tempoCopy.title}
      dismissLabel={tempoCopy.close}
      bottomInset={bottomInset}
      onDismiss={onClose}
    >
      <ModeGroup />
      <View style={styles.foot}>
        <Button label={tempoCopy.done} size="sheet" fill onPress={onClose} />
      </View>
    </Sheet>
  );
}
