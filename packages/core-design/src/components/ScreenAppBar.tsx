import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import type { IconName } from '../icons.ts';
import { screenBar } from '../roles.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={styles.button}
        onPress={onBack}
      >
        <Icon name="arrowBack" size="bar" color="text" />
      </Pressable>
      <View style={styles.heading} accessibilityRole="header" accessible>
        {children}
      </View>
      {actions.map((action) => (
        <Pressable
          key={action.label}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={styles.button}
          onPress={action.onPress}
        >
          <Icon name={action.icon} size="bar" color="text2" />
        </Pressable>
      ))}
    </View>
  );
}
