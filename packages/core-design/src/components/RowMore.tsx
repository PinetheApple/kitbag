import { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { libraryList, libraryMix } from '../libraryRoles.ts';
import { withAlpha } from '../theme.ts';
import { createThemedStyles, useTheme } from '../ThemeProvider.tsx';
import { minTouchTargetDp } from '../tokens.ts';
import { Icon } from './Icon.tsx';

const useStyles = createThemedStyles((theme) => ({
  more: {
    width: libraryList.moreWidth,
    height: minTouchTargetDp,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: withAlpha(theme.color.text, libraryMix.selectedRow),
  },
}));

export interface RowMoreProps {
  readonly title: string;
  readonly onPress: () => void;
  readonly style?: StyleProp<ViewStyle>;
}

export function RowMore({ title, onPress, style }: RowMoreProps) {
  const styles = useStyles();
  const theme = useTheme();
  const ripple = useMemo(
    () => ({
      color: withAlpha(theme.color.text, libraryMix.morePressed),
      radius: libraryList.moreWidth / 2,
    }),
    [theme],
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Actions for ${title}`}
      android_ripple={ripple}
      style={[styles.more, style]}
      onPress={onPress}
    >
      <Icon name="more" size="bar" color="text2" />
    </Pressable>
  );
}

export function MenuOpenTint({ radius }: { readonly radius: number }) {
  const styles = useStyles();
  const corner = useMemo(() => ({ borderRadius: radius }), [radius]);
  return <View pointerEvents="none" style={[styles.tint, corner]} />;
}
