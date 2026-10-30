import { useCallback } from 'react';
import { Pressable, View } from 'react-native';

import { mix, radius, size, space } from '../roles.ts';
import { mixHex, type Theme } from '../theme.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import {
  hitBoxStyle,
  hitExtension,
  neighbourGaps,
  type NeighbourGaps,
} from '../touchTarget.ts';

export type SwitchVariant = 'filled' | 'outlined';

const OUTLINED_TRACK_INNER = size.switchOutlinedWidth - size.stroke * 2;

const GEOMETRY = {
  filled: {
    width: size.switchWidth,
    height: size.switchHeight,
    radius: radius.switch,
    border: 0,
    knob: size.switchKnob,
    inset: size.switchKnobInset,
    travel: size.switchWidth - size.switchKnob - size.switchKnobInset,
  },
  outlined: {
    width: size.switchOutlinedWidth,
    height: size.switchOutlinedHeight,
    radius: radius.switchOutlined,
    border: size.stroke,
    knob: size.switchOutlinedKnob,
    inset: size.switchOutlinedKnobInset,
    travel:
      OUTLINED_TRACK_INNER -
      size.switchOutlinedKnob -
      size.switchOutlinedKnobInset,
  },
} as const satisfies Record<SwitchVariant, object>;

interface SwitchColors {
  readonly track: string;
  readonly trackOn: string;
  readonly border: string;
  readonly borderOn: string;
  readonly knob: string;
  readonly knobOn: string;
}

function colors(theme: Theme): Readonly<Record<SwitchVariant, SwitchColors>> {
  const { color } = theme;
  return {
    filled: {
      track: color.surface3,
      trackOn: color.accent,
      border: color.surface3,
      borderOn: color.accent,
      knob: color.text2,
      knobOn: color.onAccent,
    },
    outlined: {
      track: color.surface3,
      trackOn: mixHex(color.accent, color.surface3, mix.switchOutlinedOn),
      border: color.line,
      borderOn: color.accentDim,
      knob: color.text3,
      knobOn: color.accent,
    },
  };
}

function variantStyles(theme: Theme, variant: SwitchVariant) {
  const g = GEOMETRY[variant];
  const c = colors(theme)[variant];
  return {
    track: {
      width: g.width,
      height: g.height,
      borderRadius: g.radius,
      borderWidth: g.border,
      borderColor: c.border,
      backgroundColor: c.track,
    },
    trackOn: { borderColor: c.borderOn, backgroundColor: c.trackOn },
    knob: {
      position: 'absolute' as const,
      top: g.inset,
      left: g.inset,
      width: g.knob,
      height: g.knob,
      borderRadius: radius.circle,
      backgroundColor: c.knob,
    },
    knobOn: { left: g.travel, backgroundColor: c.knobOn },
  };
}

const useFilledStyles = createThemedStyles((theme) =>
  variantStyles(theme, 'filled'),
);
const useOutlinedStyles = createThemedStyles((theme) =>
  variantStyles(theme, 'outlined'),
);

export interface SwitchProps {
  readonly value: boolean;
  readonly onValueChange: (value: boolean) => void;
  readonly accessibilityLabel: string;
  /** Gaps to the controls around the track, for the 48dp hit box; a number
   * applies to every side, an omitted side has no neighbour. */
  readonly neighbourGapDp?: number | NeighbourGaps;
  readonly variant?: SwitchVariant;
}

export function SwitchTrack({
  value,
  variant = 'filled',
}: {
  readonly value: boolean;
  readonly variant?: SwitchVariant;
}) {
  const variants: Record<SwitchVariant, ReturnType<typeof useFilledStyles>> = {
    filled: useFilledStyles(),
    outlined: useOutlinedStyles(),
  };
  const styles = variants[variant];
  return (
    <View style={[styles.track, value && styles.trackOn]}>
      <View style={[styles.knob, value && styles.knobOn]} />
    </View>
  );
}

export function Switch({
  value,
  onValueChange,
  accessibilityLabel,
  neighbourGapDp = space.controlGap,
  variant = 'filled',
}: SwitchProps) {
  const geometry = GEOMETRY[variant];
  const hitBox = hitBoxStyle(
    hitExtension(
      geometry.width,
      geometry.height,
      neighbourGaps(neighbourGapDp),
    ),
  );
  const handlePress = useCallback(() => {
    onValueChange(!value);
  }, [onValueChange, value]);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
      aria-checked={value}
      style={hitBox}
      onPress={handlePress}
    >
      <SwitchTrack value={value} variant={variant} />
    </Pressable>
  );
}
