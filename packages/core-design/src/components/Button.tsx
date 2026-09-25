import { Pressable, Text } from 'react-native';

import type { IconName } from '../icons.ts';
import { inset, opacity, radius, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { hitSlopForPadded } from '../touchTarget.ts';
import { Icon } from './Icon.tsx';

export type ButtonVariant = 'primary' | 'tonal' | 'ghost' | 'destructive';

const HIT_SLOP = hitSlopForPadded(
  textRoles.button.size,
  inset.buttonV,
  space.controlGap,
);

export interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  readonly icon?: IconName;
  readonly disabled?: boolean;
  readonly fill?: boolean;
  readonly accessibilityLabel?: string;
}

export function Button({
  label,
  onPress,
  variant = 'tonal',
  icon,
  disabled = false,
  fill = false,
  accessibilityLabel,
}: ButtonProps) {
  const styles = useStyles();
  const labelStyle = styles[`${variant}Label`];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={[
        styles.base,
        styles[variant],
        fill && styles.fill,
        disabled && styles.disabled,
      ]}
      hitSlop={HIT_SLOP}
      onPress={onPress}
    >
      {icon === undefined ? null : (
        <Icon name={icon} size="control" color={ICON_COLOR[variant]} />
      )}
      <Text style={[styles.label, labelStyle]}>{label}</Text>
    </Pressable>
  );
}

const ICON_COLOR = {
  primary: 'onAccent',
  tonal: 'text',
  ghost: 'text2',
  destructive: 'onAccent',
} as const;

const useStyles = createThemedStyles((theme) => ({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.controlGap,
    paddingVertical: inset.buttonV,
    paddingHorizontal: inset.buttonH,
    borderRadius: radius.button,
    borderWidth: size.stroke,
    borderColor: 'transparent',
  },
  fill: {
    flex: 1,
  },
  disabled: {
    opacity: opacity.muted,
  },
  primary: {
    backgroundColor: theme.color.accent,
  },
  tonal: {
    backgroundColor: theme.color.surface2,
    borderColor: theme.color.line,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: theme.color.line,
  },
  destructive: {
    backgroundColor: theme.color.red,
  },
  label: {
    ...textStyle(textRoles.button),
    flexShrink: 1,
    textAlign: 'center',
  },
  primaryLabel: {
    color: theme.color.onAccent,
  },
  tonalLabel: {
    color: theme.color.text,
  },
  ghostLabel: {
    color: theme.color.text2,
  },
  destructiveLabel: {
    color: theme.color.onAccent,
  },
}));
