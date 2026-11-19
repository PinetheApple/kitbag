import {
  createThemedStyles,
  Icon,
  opacity,
  rowLabel,
  size,
  stemPlayer,
  textRoles,
  textStyle,
  type IconName,
} from '@kitbag/core-design';
import { Pressable, Text, View } from 'react-native';

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: stemPlayer.menuRowGap,
    minHeight: stemPlayer.menuRowMinHeight,
  },
  divided: {
    borderBottomWidth: size.stroke,
    borderBottomColor: theme.color.line,
  },
  disabled: { opacity: opacity.muted },
  body: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  label: { ...textStyle(textRoles.menuRow), color: theme.color.text },
  detail: { ...textStyle(textRoles.rowSubtitle), color: theme.color.text2 },
  value: { ...textStyle(textRoles.menuValue), color: theme.color.text2 },
}));

interface ValueRowProps {
  readonly icon: IconName;
  readonly title: string;
  readonly value: string;
  readonly reason: string | null;
  readonly onPress: () => void;
}

export function ValueRow({
  icon,
  title,
  value,
  reason,
  onPress,
}: ValueRowProps) {
  const styles = useStyles();
  const disabled = reason !== null;
  return (
    <View style={styles.divided}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={rowLabel(title, reason ?? value)}
        accessibilityState={{ disabled }}
        disabled={disabled}
        style={[styles.row, disabled && styles.disabled]}
        onPress={onPress}
      >
        <Icon name={icon} size="title" color="text2" />
        <View style={styles.body}>
          <Text style={styles.label}>{title}</Text>
          {disabled ? <Text style={styles.detail}>{reason}</Text> : null}
        </View>
        {disabled ? null : (
          <>
            <Text style={styles.value}>{value}</Text>
            <Icon name="forward" size="title" color="decor" />
          </>
        )}
      </Pressable>
    </View>
  );
}
