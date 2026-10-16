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
import { hitBoxStyle, hitExtension, unshared } from '../touchTarget.ts';
import { Icon } from './Icon.tsx';

const TITLE_MIN_SCALE = appBarTitleMinSize / textRoles.appBarTitle.size;

// The bar sits in the screen's inset at its top and sides, with a section gap
// below. The back key is raised over the title, which takes no touches.
const SCREEN_EDGE = unshared(inset.appBar + space.screenInset);
const BELOW = unshared(inset.appBar) + space.sectionGap;
const BACK_HIT_BOX = hitBoxStyle(
  hitExtension(iconSizes.title, iconSizes.title, {
    top: SCREEN_EDGE,
    left: SCREEN_EDGE,
    bottom: BELOW,
  }),
);
const ACTION_HIT_BOX = hitBoxStyle(
  hitExtension(iconSizes.action, iconSizes.action, {
    top: SCREEN_EDGE,
    right: SCREEN_EDGE,
    bottom: BELOW,
    left: space.controlGap,
  }),
);

export interface AppBarProps {
  readonly title: string;
  readonly onBack?: () => void;
  readonly backLabel?: string;
  readonly trailing?: ReactNode;
  readonly wordmark?: boolean;
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
  wordmark: textStyle(textRoles.wordmark),
  back: {
    ...BACK_HIT_BOX,
    zIndex: 1,
  },
}));

export function AppBar({
  title,
  onBack,
  backLabel = 'Back',
  trailing,
  wordmark = false,
}: AppBarProps) {
  const styles = useStyles();
  return (
    <View style={styles.bar}>
      <View style={styles.lead}>
        {onBack === undefined ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            style={styles.back}
            onPress={onBack}
          >
            <Icon name="back" size="title" color="text" />
          </Pressable>
        )}
        <Text
          accessibilityRole="header"
          style={[styles.title, wordmark && styles.wordmark]}
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
      style={ACTION_HIT_BOX}
      onPress={onPress}
    >
      <Icon name={icon} size="action" color="text2" />
    </Pressable>
  );
}
