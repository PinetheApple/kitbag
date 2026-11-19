import { Pressable, Text, View } from 'react-native';

import { meterRowValue } from '../meterText.ts';
import { opacity, textRoles } from '../roles.ts';
import { rowLabel } from '../rowLabel.ts';
import { stemPlayer } from '../stemPlayerRoles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { Icon } from './Icon.tsx';

const METER_TITLE = 'Meter';

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: stemPlayer.menuRowGap,
    minHeight: stemPlayer.menuRowMinHeight,
  },
  disabled: { opacity: opacity.muted },
  body: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  label: { ...textStyle(textRoles.menuRow), color: theme.color.text },
  detail: { ...textStyle(textRoles.rowSubtitle), color: theme.color.text2 },
  value: { ...textStyle(textRoles.menuValue), color: theme.color.text2 },
}));

export interface MeterRowProps {
  readonly value: number;
  readonly yours: boolean;
  readonly disabled?: boolean;
  readonly reason?: string;
  readonly onPress: () => void;
}

export function MeterRow({
  value,
  yours,
  disabled = false,
  reason,
  onPress,
}: MeterRowProps) {
  const styles = useStyles();
  const shown = meterRowValue(value, yours);
  const enabled = !disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rowLabel(METER_TITLE, enabled ? shown : reason)}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      style={[styles.row, !enabled && styles.disabled]}
      onPress={onPress}
    >
      <Icon name="metronome" size="title" color="text2" />
      <View style={styles.body}>
        <Text style={styles.label}>{METER_TITLE}</Text>
        {enabled || reason === undefined ? null : (
          <Text style={styles.detail}>{reason}</Text>
        )}
      </View>
      {enabled ? (
        <>
          <Text style={styles.value}>{shown}</Text>
          <Icon name="forward" size="title" color="decor" />
        </>
      ) : null}
    </Pressable>
  );
}
