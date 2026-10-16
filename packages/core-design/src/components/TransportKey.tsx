import { Pressable, Text, View } from 'react-native';

import { icons, type IconName } from '../icons.ts';
import { opacity, radius, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { hitSlopFor } from '../touchTarget.ts';

const HIT_SLOP = hitSlopFor(size.transportKey, space.transportGap);

export type TransportKeyContent =
  | { readonly icon: IconName; readonly text?: never }
  | { readonly text: string; readonly icon?: never };

export type TransportKeyProps = TransportKeyContent & {
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  readonly selected?: boolean;
  readonly disabled?: boolean;
};

const useStyles = createThemedStyles((theme) => ({
  key: {
    minWidth: size.transportKey,
    minHeight: size.transportKey,
    borderRadius: radius.circle,
    backgroundColor: theme.color.surface2,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    backgroundColor: theme.activeControlFill,
    borderColor: theme.color.accentDim,
  },
  disabled: {
    opacity: opacity.muted,
  },
  glyph: {
    ...textStyle(textRoles.transportKey),
    color: theme.color.text,
  },
  glyphSelected: {
    color: theme.color.accent,
  },
  spacer: {
    width: size.transportKey,
    height: size.transportKey,
  },
}));

export function TransportKey({
  icon,
  text,
  accessibilityLabel,
  onPress,
  selected = false,
  disabled = false,
}: TransportKeyProps) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      style={[
        styles.key,
        selected && styles.selected,
        disabled && styles.disabled,
      ]}
      hitSlop={HIT_SLOP}
      onPress={onPress}
    >
      <Text style={[styles.glyph, selected && styles.glyphSelected]}>
        {icon === undefined ? text : icons[icon]}
      </Text>
    </Pressable>
  );
}

export function TransportKeySpacer() {
  const styles = useStyles();
  return <View style={styles.spacer} />;
}
