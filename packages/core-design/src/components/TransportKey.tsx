import { Pressable, View } from 'react-native';

import type { IconName } from '../icons.ts';
import type { TypeRole } from '../tokens.ts';
import {
  iconSizes,
  opacity,
  radius,
  size,
  space,
  textRoles,
} from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { stemPlayer } from '../stemPlayerRoles.ts';
import { hitSlopFor } from '../touchTarget.ts';
import { DesignFloorOneLineText } from './DesignFloorOneLineText.tsx';
import { InlineIcon } from './IconGlyph.tsx';
import { KeyBadge } from './KeyBadge.tsx';

export type TransportKeySize = 'standard' | 'dock' | 'large' | 'small';

const HIT_SLOP: Readonly<Record<TransportKeySize, number>> = {
  standard: hitSlopFor(size.transportKey, space.transportGap),
  dock: 0,
  large: hitSlopFor(size.transportKeyLarge, space.transportGapWide),
  small: hitSlopFor(size.transportKeySmall, space.controlGap),
};

const TEXT_ROLES: Readonly<Record<TransportKeySize, TypeRole>> = {
  standard: textRoles.transportKey,
  dock: textRoles.dockKey,
  large: { ...textRoles.transportKey, size: iconSizes.transportLarge },
  small: { ...textRoles.transportKey, size: iconSizes.transportSmall },
};

const GLYPH_TEXT = {
  standard: textStyle(TEXT_ROLES.standard),
  dock: textStyle(TEXT_ROLES.dock),
  large: textStyle(TEXT_ROLES.large),
  small: textStyle(TEXT_ROLES.small),
} satisfies Record<TransportKeySize, unknown>;

export type TransportKeyContent =
  | { readonly icon: IconName; readonly text?: never }
  | { readonly text: string; readonly icon?: never };

export type TransportKeyProps = TransportKeyContent & {
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly muted?: boolean;
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
  dockKey: {
    minWidth: stemPlayer.transportKey,
    minHeight: stemPlayer.transportKey,
  },
  textKey: { flexShrink: 1 },
  textBox: { alignSelf: 'stretch', alignItems: 'center' },
  selected: {
    backgroundColor: theme.activeControlFill,
    borderColor: theme.color.accentDim,
  },
  disabled: {
    opacity: opacity.muted,
  },
  glyph: {
    color: theme.color.text,
  },
  glyphSelected: {
    color: theme.color[theme.accentInk],
  },
  spacer: {
    width: size.transportKey,
    height: size.transportKey,
  },
  large: {
    minWidth: size.transportKeyLarge,
    minHeight: size.transportKeyLarge,
  },
  spacerDock: {
    width: stemPlayer.transportKey,
    height: stemPlayer.transportKey,
  },
  spacerLarge: {
    width: size.transportKeyLarge,
    height: size.transportKeyLarge,
  },
  small: {
    minWidth: size.transportKeySmall,
    minHeight: size.transportKeySmall,
  },
  spacerSmall: {
    width: size.transportKeySmall,
    height: size.transportKeySmall,
  },
  badge: {
    top: -size.keyBadgeOffset,
    right: -size.keyBadgeOffset,
  },
}));

export function TransportKey({
  icon,
  text,
  accessibilityLabel,
  onPress,
  selected = false,
  disabled = false,
  muted = false,
  size: keySize = 'standard',
  badge,
}: TransportKeyProps) {
  const styles = useStyles();
  const dock = keySize === 'dock';
  const large = keySize === 'large';
  const small = keySize === 'small';
  const dimmed = disabled || muted;
  const glyphStyle = [
    GLYPH_TEXT[keySize],
    styles.glyph,
    selected && styles.glyphSelected,
  ];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled: dimmed }}
      disabled={disabled}
      style={[
        styles.key,
        dock && styles.dockKey,
        large && styles.large,
        small && styles.small,
        selected && styles.selected,
        dimmed && styles.disabled,
        icon === undefined && styles.textKey,
      ]}
      hitSlop={HIT_SLOP[keySize]}
      onPress={onPress}
    >
      {icon === undefined ? (
        <DesignFloorOneLineText
          text={text}
          role={TEXT_ROLES[keySize]}
          style={glyphStyle}
          boxStyle={styles.textBox}
        />
      ) : (
        <InlineIcon name={icon} style={glyphStyle} />
      )}
      {badge === undefined ? null : (
        <KeyBadge label={badge} style={styles.badge} />
      )}
    </Pressable>
  );
}

export function TransportKeySpacer({
  size: keySize = 'standard',
}: {
  readonly size?: TransportKeySize;
}) {
  const styles = useStyles();
  const spacer = {
    standard: styles.spacer,
    dock: styles.spacerDock,
    large: styles.spacerLarge,
    small: styles.spacerSmall,
  } satisfies Record<TransportKeySize, unknown>;
  return <View style={spacer[keySize]} />;
}
