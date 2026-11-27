import { Pressable, Text, View } from 'react-native';

import { homeArrange, homeArrangeText } from '../homeArrangeRoles.ts';
import type { IconName } from '../icons.ts';
import {
  bodyLineHeight,
  iconSizes,
  inset,
  mix,
  opacity,
  radius,
  size,
  space,
  textRoles,
  type IconSize,
} from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { mixHex } from '../theme.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { minTouchTargetDp } from '../tokens.ts';
import {
  hitBoxStyle,
  hitExtension,
  neighbourGaps,
  reachEdges,
  type NeighbourGaps,
} from '../touchTarget.ts';
import { InlineIcon } from './IconGlyph.tsx';

export type ButtonVariant =
  'primary' | 'tonal' | 'accentTonal' | 'ghost' | 'destructive';
export type ButtonAlign = 'center' | 'start';
export type ButtonDisabledLook = 'cleared' | 'outlined' | 'faded';
export type ButtonSize =
  'default' | 'sheet' | 'prompt' | 'target' | 'small' | 'bar';

const BUTTON_HEIGHT = textRoles.button.size + (inset.buttonV + size.stroke) * 2;
const BUTTON_HEIGHTS: Readonly<Record<ButtonSize, number>> = {
  default: BUTTON_HEIGHT,
  sheet: size.buttonSheet,
  prompt: size.buttonPrompt,
  target: minTouchTargetDp,
  bar: size.buttonPrompt,
  small:
    homeArrangeText.smallButton.size * bodyLineHeight +
    (homeArrange.smallButtonV + size.stroke) * 2,
};

const NO_EDGES: NeighbourGaps = {};

// A labelled button is wider than 48dp, so only the vertical axis is grown.
function buttonHitBox(
  gaps: NeighbourGaps,
  height: number,
  edges: NeighbourGaps,
) {
  return hitBoxStyle(
    reachEdges(
      hitExtension(minTouchTargetDp, height, {
        top: gaps.top,
        bottom: gaps.bottom,
      }),
      { top: edges.top, bottom: edges.bottom },
    ),
  );
}

export interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  readonly icon?: IconName;
  readonly iconSize?: IconSize;
  readonly iconTone?: 'label' | 'accent';
  readonly disabled?: boolean;
  readonly disabledLook?: ButtonDisabledLook;
  readonly align?: ButtonAlign;
  readonly fill?: boolean;
  readonly accessibilityLabel?: string;
  /** Gaps to the controls above and below, for the 48dp hit box; a number
   * applies to both, an omitted side has no neighbour. */
  readonly neighbourGapDp?: number | NeighbourGaps;
  readonly edgeRoomDp?: NeighbourGaps;
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
  start: {
    justifyContent: 'flex-start',
  },
  startLabel: {
    textAlign: 'left',
  },
  faded: {
    opacity: opacity.muted,
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
  disabledOutline: {
    borderColor: theme.color.line,
    opacity: opacity.muted,
  },
  primary: {
    backgroundColor: theme.accentTextFill,
  },
  tonal: {
    backgroundColor: theme.color.surface2,
    borderColor: theme.color.line,
  },
  accentTonal: {
    backgroundColor: mixHex(
      theme.color.accent,
      theme.color.surface2,
      mix.accentTonal,
    ),
    borderColor: theme.color.accentDim,
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
  accentTonalLabel: {
    color: theme.color[theme.accentInk],
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
  bar: {
    minHeight: size.buttonPrompt,
    paddingVertical: 0,
    paddingHorizontal: inset.buttonBarH,
  },
  small: {
    gap: space.chipGap,
    paddingVertical: homeArrange.smallButtonV,
    paddingHorizontal: homeArrange.smallButtonH,
  },
  smallLabel: {
    ...textStyle(homeArrangeText.smallButton),
    lineHeight: homeArrangeText.smallButton.size * bodyLineHeight,
  },
  accentIcon: {
    color: theme.color.accent,
  },
}));

export function Button({
  label,
  onPress,
  variant = 'tonal',
  icon,
  iconSize,
  iconTone = 'label',
  disabled = false,
  disabledLook = 'cleared',
  align = 'center',
  fill = false,
  accessibilityLabel,
  neighbourGapDp = space.controlGap,
  edgeRoomDp = NO_EDGES,
  size: buttonSize = 'default',
}: ButtonProps) {
  const styles = useStyles();
  const faded = disabled && disabledLook === 'faded';
  const cleared = disabled && !faded;
  const labelStyle = cleared ? styles.disabledLabel : styles[`${variant}Label`];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={[
        buttonHitBox(
          neighbourGaps(neighbourGapDp),
          BUTTON_HEIGHTS[buttonSize],
          edgeRoomDp,
        ),
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
          align === 'start' && styles.start,
          cleared && styles.disabled,
          cleared && disabledLook === 'outlined' && styles.disabledOutline,
          faded && styles.faded,
        ]}
      >
        {icon === undefined ? null : (
          <InlineIcon
            name={icon}
            style={[
              styles.icon,
              iconSize !== undefined && { fontSize: iconSizes[iconSize] },
              labelStyle,
              iconTone === 'accent' && !disabled && styles.accentIcon,
            ]}
          />
        )}
        <Text
          style={[
            styles.label,
            buttonSize === 'small' && styles.smallLabel,
            align === 'start' && styles.startLabel,
            labelStyle,
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
