import { Pressable } from 'react-native';

import type { IconName } from '../icons.ts';
import { radius, size } from '../roles.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { Icon } from './Icon.tsx';

const useStyles = createThemedStyles((theme) => ({
  fab: {
    alignSelf: 'flex-end',
    width: size.fab,
    height: size.fab,
    borderRadius: radius.fab,
    backgroundColor: theme.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: theme.shadow,
  },
}));

export interface FloatingActionButtonProps {
  readonly icon: IconName;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
}

export function FloatingActionButton(props: FloatingActionButtonProps) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      style={styles.fab}
      onPress={props.onPress}
    >
      <Icon name={props.icon} size="fab" color="onAccent" />
    </Pressable>
  );
}
