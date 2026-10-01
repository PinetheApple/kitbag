import { Pressable, Text } from 'react-native';

import { icons, type IconName } from '../icons.ts';
import { iconSizes, radius, size } from '../roles.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';

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
  glyph: { color: theme.color.onAccent, fontSize: iconSizes.fab },
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
      <Text style={styles.glyph}>{icons[props.icon]}</Text>
    </Pressable>
  );
}
