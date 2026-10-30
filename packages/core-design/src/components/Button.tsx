import { Pressable, Text, View } from 'react-native';

import type { IconName } from '../icons.ts';
import {
  iconSizes,
  inset,
  radius,
  size,
  space,
  textRoles,
  type IconSize,
} from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { minTouchTargetDp } from '../tokens.ts';
import {
  hitBoxStyle,
  hitExtension,
  neighbourGaps,
  type NeighbourGaps,
} from '../touchTarget.ts';
import { InlineIcon } from './IconGlyph.tsx';

export type ButtonVariant = 'primary' | 'tonal' | 'ghost' | 'destructive';
export type ButtonSize = 'default' | 'sheet' | 'prompt' | 'target';

const BUTTON_HEIGHT = textRoles.button.size + (inset.buttonV + size.stroke) * 2;
const BUTTON_HEIGHTS: Readonly<Record<ButtonSize, number>> = {
  default: BUTTON_HEIGHT,
  sheet: size.buttonSheet,
  prompt: size.buttonPrompt,
  target: minTouchTargetDp,
};

// A labelled button is wider than 48dp, so only the vertical axis is grown.
function buttonHitBox(gaps: NeighbourGaps, height: number) {
  return hitBoxStyle(
    hitExtension(minTouchTargetDp, height, {
      top: gaps.top,
      bottom: gaps.bottom,
    }),
  );
}

export interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  readonly icon?: IconName;
  readonly iconSize?: IconSize;
  readonly disabled?: boolean;
  readonly fill?: boolean;
  readonly accessibilityLabel?: string;
  /** Gaps to the controls above and below, for the 48dp hit box; a number
   * applies to both, an omitted side has no neighbour. */
  readonly neighbourGapDp?: number | NeighbourGaps;
  readonly size?: ButtonSize;
}

const useStyles = createThemedStyles((theme) => ({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.controlGap,
    paddingVertical: inset.buttonV,
    paddingHorizontal: inset.buttonH,
    borderRadius: radius.button,
    borderWidth: size.stroke,
    borderColor: 'transparent',
  },
  fill: {
    flex: 1,
  },
  fillFace: {
    flexGrow: 1,
  },
  // No fill and no border so it cannot pass for a ghost button, and no
  // opacity so the label keeps AA contrast (theme.test.ts).
  disabled: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  primary: {
    backgroundColor: theme.color.accent,
  },
  tonal: {
    backgroundColor: theme.color.surface2,
    borderColor: theme.color.line,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: theme.color.line,
  },
  destructive: {
    backgroundColor: theme.feedback.danger.fg,
  },
  icon: {
    fontSize: iconSizes.control,
  },
  label: {
    ...textStyle(textRoles.button),
    flexShrink: 1,
    textAlign: 'center',
  },
  primaryLabel: {
    color: theme.color.onAccent,
  },
  tonalLabel: {
    color: theme.color.text,
  },
  ghostLabel: {
    color: theme.color.text2,
  },
  destructiveLabel: {
    color: theme.onDanger,
  },
  disabledLabel: {
    color: theme.disabledLabel,
  },
  sheet: {
    minHeight: size.buttonSheet,
    paddingVertical: 0,
  },
  prompt: {
    minHeight: size.buttonPrompt,
    paddingVertical: 0,
  },
  target: {
    minHeight: minTouchTargetDp,
    paddingVertical: 0,
  },
}));

export function Button({
  label,
  onPress,
  variant = 'tonal',
  icon,
  iconSize,
  disabled = false,
  fill = false,
  accessibilityLabel,
  neighbourGapDp = space.controlGap,
  size: buttonSize = 'default',
}: ButtonProps) {
  const styles = useStyles();
  const labelStyle = disabled
    ? styles.disabledLabel
    : styles[`${variant}Label`];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={[
        buttonHitBox(neighbourGaps(neighbourGapDp), BUTTON_HEIGHTS[buttonSize]),
        fill && styles.fill,
      ]}
      onPress={onPress}
    >
      <View
        style={[
          styles.base,
          styles[variant],
          buttonSize !== 'default' && styles[buttonSize],
          fill && styles.fillFace,
          disabled && styles.disabled,
        ]}
      >
        {icon === undefined ? null : (
          <InlineIcon
            name={icon}
            style={[
              styles.icon,
              iconSize !== undefined && { fontSize: iconSizes[iconSize] },
              labelStyle,
            ]}
          />
        )}
        <Text style={[styles.label, labelStyle]}>{label}</Text>
      </View>
    </Pressable>
  );
}
