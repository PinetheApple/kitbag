import { Pressable } from 'react-native';

import type { IconName } from '../icons.ts';
import { libraryList } from '../libraryRoles.ts';
import { radius, size } from '../roles.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { Icon } from './Icon.tsx';

export type FloatingActionButtonVariant = 'default' | 'list';

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
  list: {
    position: 'absolute',
    right: libraryList.fabEnd,
    width: libraryList.fab,
    height: libraryList.fab,
  },
}));

export interface FloatingActionButtonProps {
  readonly icon: IconName;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  readonly variant?: FloatingActionButtonVariant;
  readonly bottomInset?: number;
}

export function FloatingActionButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = 'default',
  bottomInset = 0,
}: FloatingActionButtonProps) {
  const styles = useStyles();
  const list = variant === 'list';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.fab,
        list && styles.list,
        list && { bottom: bottomInset + libraryList.fabBottom },
      ]}
      onPress={onPress}
    >
      <Icon name={icon} size={list ? 'listFab' : 'fab'} color="onAccent" />
    </Pressable>
  );
}
