import { Pressable, Text, View } from 'react-native';

import { icons, type IconName } from '../icons.ts';
import { iconSizes, inset, radius, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { minTouchTargetDp } from '../tokens.ts';
import {
  hitBoxStyle,
  hitExtension,
  neighbourGaps,
  type NeighbourGaps,
} from '../touchTarget.ts';

export type ButtonVariant = 'primary' | 'tonal' | 'ghost' | 'destructive';

const BUTTON_HEIGHT = textRoles.button.size + (inset.buttonV + size.stroke) * 2;

// A labelled button is wider than 48dp, so only the vertical axis is grown.
function buttonHitBox(gaps: NeighbourGaps) {
  return hitBoxStyle(
    hitExtension(minTouchTargetDp, BUTTON_HEIGHT, {
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
  readonly disabled?: boolean;
  readonly fill?: boolean;
  readonly accessibilityLabel?: string;
  /** Gaps to the controls above and below, for the 48dp hit box; a number
   * applies to both, an omitted side has no neighbour. */
  readonly neighbourGapDp?: number | NeighbourGaps;
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
}));

export function Button({
  label,
  onPress,
  variant = 'tonal',
  icon,
  disabled = false,
  fill = false,
  accessibilityLabel,
  neighbourGapDp = space.controlGap,
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
      style={[buttonHitBox(neighbourGaps(neighbourGapDp)), fill && styles.fill]}
      onPress={onPress}
    >
      <View
        style={[
          styles.base,
          styles[variant],
          fill && styles.fillFace,
          disabled && styles.disabled,
        ]}
      >
        {icon === undefined ? null : (
          <Text
            importantForAccessibility="no-hide-descendants"
            style={[styles.icon, labelStyle]}
          >
            {icons[icon]}
          </Text>
        )}
        <Text style={[styles.label, labelStyle]}>{label}</Text>
      </View>
    </Pressable>
  );
}
