import { Pressable, Text, View } from 'react-native';

import type { IconName } from '../icons.ts';
import {
  iconSizes,
  inset,
  opacity,
  radius,
  size,
  space,
  textRoles,
} from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { hitSlopFor } from '../touchTarget.ts';
import { InlineIcon } from './IconGlyph.tsx';

export type TransportKeySize = 'default' | 'large';

const HIT_SLOP: Readonly<Record<TransportKeySize, number>> = {
  default: hitSlopFor(size.transportKey, space.transportGap),
  large: hitSlopFor(size.transportKeyLarge, space.transportGapWide),
};

export type TransportKeyContent =
  | { readonly icon: IconName; readonly text?: never }
  | { readonly text: string; readonly icon?: never };

export type TransportKeyProps = TransportKeyContent & {
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly size?: TransportKeySize;
  readonly badge?: string | undefined;
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
  large: {
    minWidth: size.transportKeyLarge,
    minHeight: size.transportKeyLarge,
  },
  glyphLarge: {
    fontSize: iconSizes.transportLarge,
  },
  spacerLarge: {
    width: size.transportKeyLarge,
    height: size.transportKeyLarge,
  },
  badge: {
    position: 'absolute',
    top: -size.keyBadgeOffset,
    right: -size.keyBadgeOffset,
    minWidth: size.keyBadge,
    minHeight: size.keyBadge,
    paddingHorizontal: inset.keyBadgeH,
    borderRadius: radius.keyBadge,
    backgroundColor: theme.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: {
    ...textStyle(textRoles.keyBadge),
    color: theme.color.onAccent,
    includeFontPadding: false,
  },
}));

export function TransportKey({
  icon,
  text,
  accessibilityLabel,
  onPress,
  selected = false,
  disabled = false,
  size: keySize = 'default',
  badge,
}: TransportKeyProps) {
  const styles = useStyles();
  const large = keySize === 'large';
  const glyphStyle = [
    styles.glyph,
    large && styles.glyphLarge,
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
        large && styles.large,
        selected && styles.selected,
        disabled && styles.disabled,
      ]}
      hitSlop={HIT_SLOP[keySize]}
      onPress={onPress}
    >
      {icon === undefined ? (
        <Text style={glyphStyle}>{text}</Text>
      ) : (
        <InlineIcon name={icon} style={glyphStyle} />
      )}
      {badge === undefined ? null : (
        <View
          style={styles.badge}
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={styles.badgeLabel}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function TransportKeySpacer({
  size: keySize = 'default',
}: {
  readonly size?: TransportKeySize;
}) {
  const styles = useStyles();
  return (
    <View style={keySize === 'large' ? styles.spacerLarge : styles.spacer} />
  );
}
