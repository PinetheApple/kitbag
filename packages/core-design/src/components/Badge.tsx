import { Text, View } from 'react-native';

import type { IconName } from '../icons.ts';
import { libraryList } from '../libraryRoles.ts';
import {
  iconSizes,
  inset,
  lineRatio,
  radius,
  size,
  space,
  textRoles,
} from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import type { FeedbackTone } from '../theme.ts';
import { createThemedStyles, useTheme } from '../ThemeProvider.tsx';
import { InlineIcon } from './IconGlyph.tsx';

export type BadgeTone = 'default' | 'accent' | 'success' | 'warning' | 'danger';

export type BadgeVariant = 'default' | 'list';

export interface BadgeProps {
  readonly label: string;
  readonly tone?: BadgeTone;
  readonly icon?: IconName;
  readonly accessibilityLabel?: string;
  readonly variant?: BadgeVariant;
}

function feedbackTone(tone: BadgeTone): FeedbackTone | null {
  return tone === 'default' || tone === 'accent' ? null : tone;
}

const useStyles = createThemedStyles((theme) => ({
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: inset.badgeV,
    paddingHorizontal: inset.badgeH,
    borderRadius: radius.badge,
    backgroundColor: theme.color.surface2,
    borderWidth: size.stroke,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.inlineKeyGap,
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
  list: {
    paddingVertical: libraryList.badgeV,
    gap: libraryList.badgeIconGap,
    alignSelf: 'auto',
    backgroundColor: theme.color.surface1,
  },
  listLabel: {
    ...textStyle(textRoles.listBadge),
    lineHeight: textRoles.listBadge.size * lineRatio.badge,
  },
  listIcon: { fontSize: iconSizes.listBadge },
  listAccentLabel: { color: theme.color[theme.accentInk] },
}));

export function Badge({
  label,
  tone = 'default',
  icon,
  accessibilityLabel,
  variant = 'default',
}: BadgeProps) {
  const styles = useStyles();
  const theme = useTheme();
  const list = variant === 'list';
  const feedback = feedbackTone(tone);
  const listBorder =
    list && feedback !== null
      ? { borderColor: theme.feedback[feedback].listBadgeBorder }
      : null;
  const labelStyle = [
    styles.label,
    list && styles.listLabel,
    styles[`${tone}Label`],
    list && tone === 'accent' && styles.listAccentLabel,
  ];
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.badge,
        styles[`${tone}Box`],
        list && styles.list,
        listBorder,
      ]}
    >
      {icon === undefined ? null : (
        <InlineIcon name={icon} style={[labelStyle, list && styles.listIcon]} />
      )}
      <Text style={labelStyle}>{label}</Text>
    </View>
  );
}
