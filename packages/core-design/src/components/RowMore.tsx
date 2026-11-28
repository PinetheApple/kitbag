import { useMemo } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { libraryList, libraryMix } from '../libraryRoles.ts';
import { withAlpha } from '../theme.ts';
import { createThemedStyles, useTheme } from '../ThemeProvider.tsx';
import { minTouchTargetDp } from '../tokens.ts';
import { Icon } from './Icon.tsx';

const useStyles = createThemedStyles(() => ({
  more: {
    width: libraryList.moreWidth,
    height: minTouchTargetDp,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

export interface RowMoreProps {
  readonly subject: string;
  readonly onPress: () => void;
  readonly style?: StyleProp<ViewStyle>;
}

export function RowMore({ subject, onPress, style }: RowMoreProps) {
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
      accessibilityLabel={`Actions for ${subject}`}
      android_ripple={ripple}
      style={[styles.more, style]}
      onPress={onPress}
    >
      <Icon name="more" size="bar" color="text2" />
    </Pressable>
  );
}
