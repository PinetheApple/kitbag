import type { ReactNode } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import type { IconName } from '../icons.ts';
import {
  appBarTitleMinSize,
  lineRatio,
  screenBar,
  space,
  textRoles,
  type IconSize,
} from '../roles.ts';
import { oneLineFloor } from '../oneLineFit.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import type { ColorToken } from '../tokens.ts';
import { useOneLineFit } from '../useOneLineFit.tsx';
import { useTextIconScale } from '../useTextIconScale.ts';
import { Icon } from './Icon.tsx';

const useStyles = createThemedStyles((theme) => ({
  bar: {
    minHeight: screenBar.height,
    flexDirection: 'row',
    alignItems: 'center',
    gap: screenBar.gap,
    paddingHorizontal: screenBar.h,
    marginHorizontal: -space.screenInset,
  },
  flush: {
    marginHorizontal: 0,
  },
  packed: {
    gap: 0,
  },
  noBack: {
    paddingLeft: space.screenInset,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: screenBar.gap,
  },
  button: {
    width: screenBar.iconButton,
    height: screenBar.iconButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heading: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...textStyle(textRoles.appBarTitle),
    lineHeight: textRoles.appBarTitle.size * lineRatio.appBarTitle,
    color: theme.color.text,
  },
  wordmark: textStyle(textRoles.wordmark),
  subtitle: {
    ...textStyle(textRoles.appBarSubtitle),
    color: theme.color.text2,
  },
}));

export interface BarIconButtonProps {
  readonly icon: IconName;
  readonly label: string;
  readonly onPress: () => void;
  readonly color?: ColorToken;
  readonly size?: IconSize;
  readonly disabled?: boolean;
}

export function BarIconButton({
  icon,
  label,
  onPress,
  color = 'text2',
  size = 'bar',
  disabled = false,
}: BarIconButtonProps) {
  const styles = useStyles();
  const iconScale = useTextIconScale();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={styles.button}
      onPress={onPress}
    >
      <Icon
        name={icon}
        size={size}
        color={disabled ? 'decor' : color}
        scale={iconScale}
      />
    </Pressable>
  );
}

export interface AppBarAction {
  readonly icon: IconName;
  readonly label: string;
  readonly onPress: () => void;
}

export interface AppBarProps {
  readonly title?: string;
  readonly subtitle?: string | undefined;
  readonly wordmark?: boolean;
  readonly onBack?: (() => void) | undefined;
  readonly backLabel?: string;
  readonly trailing?: ReactNode;
  readonly actions?: readonly AppBarAction[];
  readonly flush?: boolean;
  readonly packed?: boolean;
  readonly children?: ReactNode;
}

interface HeadingProps {
  readonly title: string;
  readonly subtitle: string | undefined;
  readonly wordmark: boolean;
}

function Heading({ title, subtitle, wordmark }: HeadingProps) {
  const styles = useStyles();
  const { fontScale } = useWindowDimensions();
  const role = wordmark ? textRoles.wordmark : textRoles.appBarTitle;
  const titleStyle = [styles.title, wordmark && styles.wordmark];
  const fit = useOneLineFit({
    text: title,
    role,
    floor: oneLineFloor(fontScale, role.size, appBarTitleMinSize),
    style: titleStyle,
  });
  return (
    <View style={styles.heading} onLayout={fit.onAvailableLayout}>
      {fit.measurer}
      <View accessibilityRole="header" accessible>
        <Text
          style={[titleStyle, fit.style]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
        {subtitle === undefined ? null : (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  );
}

export function AppBar({
  title,
  subtitle,
  wordmark = false,
  onBack,
  backLabel = 'Back',
  trailing,
  actions = [],
  flush = false,
  packed = false,
  children,
}: AppBarProps) {
  const styles = useStyles();
  return (
    <View
      style={[
        styles.bar,
        flush && styles.flush,
        packed && styles.packed,
        onBack === undefined && styles.noBack,
      ]}
    >
      {onBack === undefined ? null : (
        <BarIconButton
          icon="back"
          label={backLabel}
          color="text"
          onPress={onBack}
        />
      )}
      <View style={styles.middle}>
        {title === undefined ? null : (
          <Heading title={title} subtitle={subtitle} wordmark={wordmark} />
        )}
        {children}
      </View>
      {trailing === undefined || trailing === null ? null : (
        <View style={styles.trailing}>{trailing}</View>
      )}
      {actions.map((action) => (
        <BarIconButton
          key={action.label}
          icon={action.icon}
          label={action.label}
          onPress={action.onPress}
        />
      ))}
    </View>
  );
}
