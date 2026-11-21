import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { inset, radius, size, textRoles } from '../roles.ts';
import { TEXT_ICON_SCALE_MAX } from '../textScale.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';

const useStyles = createThemedStyles((theme) => ({
  badge: {
    position: 'absolute',
    minWidth: size.keyBadge,
    minHeight: size.keyBadge,
    paddingHorizontal: inset.keyBadgeH,
    borderRadius: radius.keyBadge,
    backgroundColor: theme.accentTextFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...textStyle(textRoles.keyBadge),
    color: theme.color.onAccent,
    includeFontPadding: false,
  },
}));

export interface KeyBadgeProps {
  readonly label: string;
  readonly style: StyleProp<ViewStyle>;
}

export function KeyBadge({ label, style }: KeyBadgeProps) {
  const styles = useStyles();
  return (
    <View
      style={[styles.badge, style]}
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={styles.label} maxFontSizeMultiplier={TEXT_ICON_SCALE_MAX}>
        {label}
      </Text>
    </View>
  );
}
