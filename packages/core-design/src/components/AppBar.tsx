import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { IconName } from '../icons.ts';
import {
  appBarTitleMinSize,
  iconSizes,
  inset,
  space,
  textRoles,
} from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { hitSlopFor } from '../touchTarget.ts';
import { Icon } from './Icon.tsx';

const TITLE_MIN_SCALE = appBarTitleMinSize / textRoles.appBarTitle.size;
const BACK_HIT_SLOP = hitSlopFor(textRoles.appBarTitle.size, space.controlGap);
const ACTION_HIT_SLOP = hitSlopFor(iconSizes.action, space.controlGap);

export interface AppBarProps {
  readonly title: string;
  readonly onBack?: () => void;
  readonly backLabel?: string;
  readonly trailing?: ReactNode;
}

export function AppBar({
  title,
  onBack,
  backLabel = 'Back',
  trailing,
}: AppBarProps) {
  const styles = useStyles();
  return (
    <View style={styles.bar}>
      <View style={styles.lead}>
        {onBack === undefined ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            hitSlop={BACK_HIT_SLOP}
            onPress={onBack}
          >
            <Icon name="back" size="title" color="text" />
          </Pressable>
        )}
        <Text
          accessibilityRole="header"
          style={styles.title}
          numberOfLines={1}
          ellipsizeMode="tail"
          adjustsFontSizeToFit
          minimumFontScale={TITLE_MIN_SCALE}
        >
          {title}
        </Text>
      </View>
      {trailing}
    </View>
  );
}

export interface AppBarActionProps {
  readonly icon: IconName;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
}

export function AppBarAction({
  icon,
  accessibilityLabel,
  onPress,
}: AppBarActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={ACTION_HIT_SLOP}
      onPress={onPress}
    >
      <Icon name={icon} size="action" color="text2" />
    </Pressable>
  );
}

const useStyles = createThemedStyles((theme) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.controlGap,
    padding: inset.appBar,
  },
  lead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.chipGap,
    flexShrink: 1,
  },
  title: {
    ...textStyle(textRoles.appBarTitle),
    color: theme.color.text,
    flexShrink: 1,
  },
}));
