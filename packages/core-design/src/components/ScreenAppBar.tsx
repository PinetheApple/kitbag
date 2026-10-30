import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import type { IconName } from '../icons.ts';
import { screenBar, type IconSize } from '../roles.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import type { ColorToken } from '../tokens.ts';
import { Icon } from './Icon.tsx';

const useStyles = createThemedStyles(() => ({
  bar: {
    minHeight: screenBar.height,
    flexDirection: 'row',
    alignItems: 'center',
    gap: screenBar.gap,
    paddingHorizontal: screenBar.h,
  },
  button: {
    width: screenBar.iconButton,
    height: screenBar.iconButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { flex: 1, minWidth: 0 },
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={styles.button}
      onPress={onPress}
    >
      <Icon name={icon} size={size} color={disabled ? 'text3' : color} />
    </Pressable>
  );
}

export interface ScreenBarAction {
  readonly icon: IconName;
  readonly label: string;
  readonly onPress: () => void;
}

export interface ScreenAppBarProps {
  readonly onBack: () => void;
  readonly actions?: readonly ScreenBarAction[];
  readonly children: ReactNode;
}

export function ScreenAppBar({
  onBack,
  actions = [],
  children,
}: ScreenAppBarProps) {
  const styles = useStyles();
  return (
    <View style={styles.bar}>
      <BarIconButton
        icon="arrowBack"
        label="Back"
        color="text"
        onPress={onBack}
      />
      <View style={styles.heading} accessibilityRole="header" accessible>
        {children}
      </View>
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
