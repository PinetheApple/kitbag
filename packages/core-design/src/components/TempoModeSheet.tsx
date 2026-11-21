import { Text, View } from 'react-native';

import { space, textRoles } from '../roles.ts';
import { tempoSheetCopy } from '../tempoText.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { Button } from './Button.tsx';
import { MenuRow } from './MenuRow.tsx';
import { SectionHeader } from './SectionHeader.tsx';
import { SegmentedControl, type SegmentOption } from './SegmentedControl.tsx';
import { Sheet } from './Sheet.tsx';

const useStyles = createThemedStyles((theme) => ({
  group: { gap: space.controlGap },
  hint: { ...textStyle(textRoles.sheetHint), color: theme.color.text2 },
  foot: { flexDirection: 'row', gap: space.controlGap },
}));

export interface TempoModeRowProps {
  readonly value: string;
  readonly reason: string | null;
  readonly onPress: () => void;
}

export function TempoModeRow({ value, reason, onPress }: TempoModeRowProps) {
  const disabled = reason !== null;
  return (
    <MenuRow
      icon="tempoMode"
      label={tempoSheetCopy.row}
      detail={reason ?? undefined}
      value={disabled ? undefined : value}
      disabled={disabled}
      onPress={onPress}
    />
  );
}

export interface TempoModeSheetProps<M extends string> {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly options: readonly SegmentOption<M>[];
  readonly selected: M | null;
  readonly constantLine: string | null;
  readonly hint: string | null;
  readonly onSelect: (mode: M) => void;
  readonly onClose: () => void;
}

function Hint({ text }: { readonly text: string | null }) {
  const styles = useStyles();
  return text === null ? null : <Text style={styles.hint}>{text}</Text>;
}

export function TempoModeSheet<M extends string>({
  visible,
  bottomInset,
  options,
  selected,
  constantLine,
  hint,
  onSelect,
  onClose,
}: TempoModeSheetProps<M>) {
  const styles = useStyles();
  return (
    <Sheet
      visible={visible}
      title={tempoSheetCopy.title}
      dismissLabel={tempoSheetCopy.close}
      bottomInset={bottomInset}
      onDismiss={onClose}
    >
      <View style={styles.group}>
        <SectionHeader label={tempoSheetCopy.grid} />
        <SegmentedControl
          size="large"
          options={options}
          selected={selected ?? undefined}
          accessibilityLabel={tempoSheetCopy.row}
          onSelect={onSelect}
        />
        <Hint text={constantLine} />
        <Hint text={hint} />
      </View>
      <View style={styles.foot}>
        <Button
          label={tempoSheetCopy.done}
          size="sheet"
          fill
          onPress={onClose}
        />
      </View>
    </Sheet>
  );
}
