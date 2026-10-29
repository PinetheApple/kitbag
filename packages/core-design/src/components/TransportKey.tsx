import { Pressable, Text, View } from 'react-native';

import type { IconName } from '../icons.ts';
import { opacity, radius, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { stemPlayer } from '../stemPlayerRoles.ts';
import { hitSlopFor } from '../touchTarget.ts';
import { InlineIcon } from './IconGlyph.tsx';

const HIT_SLOP = hitSlopFor(size.transportKey, space.transportGap);

export type TransportKeyContent =
  | { readonly icon: IconName; readonly text?: never }
  | { readonly text: string; readonly icon?: never };

export type TransportKeyProps = TransportKeyContent & {
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly size?: TransportKeySize;
};

export type TransportKeySize = 'standard' | 'dock';

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
  dockKey: {
    minWidth: stemPlayer.transportKey,
    minHeight: stemPlayer.transportKey,
  },
  dockGlyph: textStyle(textRoles.dockKey),
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
  size: keySize = 'standard',
}: TransportKeyProps) {
  const styles = useStyles();
  const dock = keySize === 'dock';
  const glyphStyle = [
    styles.glyph,
    dock && styles.dockGlyph,
    selected && styles.glyphSelected,
  ];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      style={[
        styles.key,
        dock && styles.dockKey,
        selected && styles.selected,
        disabled && styles.disabled,
      ]}
      hitSlop={dock ? 0 : HIT_SLOP}
      onPress={onPress}
    >
      {icon === undefined ? (
        <Text style={glyphStyle}>{text}</Text>
      ) : (
        <InlineIcon name={icon} style={glyphStyle} />
      )}
    </Pressable>
  );
}

export function TransportKeySpacer() {
  const styles = useStyles();
  return <View style={styles.spacer} />;
}
