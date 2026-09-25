import { Text, View } from 'react-native';

import { icons, type IconName } from '../icons.ts';
import { inset, radius, size, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';

export type BadgeTone = 'default' | 'accent' | 'success' | 'warning' | 'danger';

export interface BadgeProps {
  readonly label: string;
  readonly tone?: BadgeTone;
  readonly icon?: IconName;
  readonly accessibilityLabel?: string;
}

export function Badge({
  label,
  tone = 'default',
  icon,
  accessibilityLabel,
}: BadgeProps) {
  const styles = useStyles();
  const text = icon === undefined ? label : `${icons[icon]} ${label}`;
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.badge, styles[`${tone}Box`]]}
    >
      <Text style={[styles.label, styles[`${tone}Label`]]}>{text}</Text>
    </View>
  );
}

const useStyles = createThemedStyles((theme) => ({
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: inset.badgeV,
    paddingHorizontal: inset.badgeH,
    borderRadius: radius.badge,
    backgroundColor: theme.color.surface2,
    borderWidth: size.stroke,
  },
  label: {
    ...textStyle(textRoles.badge),
  },
  defaultBox: { borderColor: theme.color.line },
  defaultLabel: { color: theme.color.text2 },
  accentBox: { borderColor: theme.color.accentDim },
  accentLabel: { color: theme.color.accent },
  successBox: { borderColor: theme.feedback.success.badgeBorder },
  successLabel: { color: theme.feedback.success.fg },
  warningBox: { borderColor: theme.feedback.warning.badgeBorder },
  warningLabel: { color: theme.feedback.warning.fg },
  dangerBox: { borderColor: theme.feedback.danger.badgeBorder },
  dangerLabel: { color: theme.feedback.danger.fg },
}));
