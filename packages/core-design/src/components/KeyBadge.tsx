import { useMemo } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { inset, radius, size, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';

const DESIGN_SCALE = 1;

const useStyles = createThemedStyles((theme) => ({
  badge: {
    position: 'absolute',
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
  readonly scale?: number;
}

export function KeyBadge({
  label,
  style,
  scale = DESIGN_SCALE,
}: KeyBadgeProps) {
  const styles = useStyles();
  const box = useMemo(
    () => ({
      minWidth: size.keyBadge * scale,
      minHeight: size.keyBadge * scale,
      paddingHorizontal: inset.keyBadgeH * scale,
      borderRadius: radius.keyBadge * scale,
    }),
    [scale],
  );
  return (
    <View
      style={[styles.badge, box, style]}
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={styles.label} maxFontSizeMultiplier={scale}>
        {label}
      </Text>
    </View>
  );
}
