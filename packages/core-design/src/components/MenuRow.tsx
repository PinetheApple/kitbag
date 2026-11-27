import { Pressable, Text, View } from 'react-native';

import type { IconName } from '../icons.ts';
import { opacity, textRoles } from '../roles.ts';
import { rowLabel } from '../rowLabel.ts';
import { stemPlayer } from '../stemPlayerRoles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { Icon } from './Icon.tsx';

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
  accentValue: { color: theme.color[theme.accentInk] },
}));

export interface MenuRowProps {
  readonly icon: IconName;
  readonly label: string;
  readonly detail?: string | undefined;
  readonly value?: string | undefined;
  readonly spokenValue?: string | undefined;
  readonly valueTone?: 'plain' | 'accent';
  readonly disabled?: boolean;
  readonly onPress: () => void;
}

function menuRowLabel(
  label: string,
  value: string | undefined,
  detail: string | undefined,
): string {
  const facts = [value, detail].filter((fact) => fact !== undefined);
  return facts.length === 0 ? label : rowLabel(label, facts.join(', '));
}

export function MenuRow({
  icon,
  label,
  detail,
  value,
  spokenValue = value,
  valueTone = 'plain',
  disabled = false,
  onPress,
}: MenuRowProps) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={menuRowLabel(label, spokenValue, detail)}
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={[styles.row, disabled && styles.disabled]}
      onPress={onPress}
    >
      <Icon name={icon} size="title" color="text2" />
      <View style={styles.body}>
        <Text style={styles.label}>{label}</Text>
        {detail === undefined ? null : (
          <Text style={styles.detail}>{detail}</Text>
        )}
      </View>
      {value === undefined ? null : (
        <Text
          style={[styles.value, valueTone === 'accent' && styles.accentValue]}
        >
          {value}
        </Text>
      )}
      {disabled ? null : <Icon name="forward" size="title" color="decor" />}
    </Pressable>
  );
}
