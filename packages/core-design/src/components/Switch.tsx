import { useCallback } from 'react';
import { Pressable, View } from 'react-native';

import { mix, radius, size, space } from '../roles.ts';
import { mixHex } from '../theme.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import {
  hitBoxStyle,
  hitExtension,
  neighbourGaps,
  type NeighbourGaps,
} from '../touchTarget.ts';

const KNOB_TRAVEL = size.switchWidth - size.switchKnob - size.switchKnobInset;
// An absolute knob is placed inside the track's border.
const OUTLINED_KNOB_TRAVEL =
  size.switchOutlinedWidth -
  size.stroke * 2 -
  size.switchOutlinedKnob -
  size.switchOutlinedKnobInset;

export type SwitchVariant = 'filled' | 'outlined';

const TRACK_SIZE: Readonly<
  Record<SwitchVariant, { readonly width: number; readonly height: number }>
> = {
  filled: { width: size.switchWidth, height: size.switchHeight },
  outlined: {
    width: size.switchOutlinedWidth,
    height: size.switchOutlinedHeight,
  },
};

export interface SwitchProps {
  readonly value: boolean;
  readonly onValueChange: (value: boolean) => void;
  readonly accessibilityLabel: string;
  /** Gaps to the controls around the track, for the 48dp hit box; a number
   * applies to every side, an omitted side has no neighbour. */
  readonly neighbourGapDp?: number | NeighbourGaps;
  readonly variant?: SwitchVariant;
}

const useStyles = createThemedStyles((theme) => ({
  track: {
    width: size.switchWidth,
    height: size.switchHeight,
    borderRadius: radius.switch,
    backgroundColor: theme.color.surface3,
  },
  trackOn: {
    backgroundColor: theme.color.accent,
  },
  knob: {
    position: 'absolute',
    top: size.switchKnobInset,
    left: size.switchKnobInset,
    width: size.switchKnob,
    height: size.switchKnob,
    borderRadius: radius.circle,
    backgroundColor: theme.color.text2,
  },
  knobOn: {
    left: KNOB_TRAVEL,
    backgroundColor: theme.color.onAccent,
  },
  outlinedTrack: {
    width: size.switchOutlinedWidth,
    height: size.switchOutlinedHeight,
    borderRadius: radius.switchOutlined,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface3,
  },
  outlinedTrackOn: {
    borderColor: theme.color.accentDim,
    backgroundColor: mixHex(
      theme.color.accent,
      theme.color.surface3,
      mix.switchOn,
    ),
  },
  outlinedKnob: {
    position: 'absolute',
    top: size.switchOutlinedKnobInset,
    left: size.switchOutlinedKnobInset,
    width: size.switchOutlinedKnob,
    height: size.switchOutlinedKnob,
    borderRadius: radius.circle,
    backgroundColor: theme.color.text3,
  },
  outlinedKnobOn: {
    left: OUTLINED_KNOB_TRAVEL,
    backgroundColor: theme.color.accent,
  },
}));

export function Switch({
  value,
  onValueChange,
  accessibilityLabel,
  neighbourGapDp = space.controlGap,
  variant = 'filled',
}: SwitchProps) {
  const styles = useStyles();
  const track = TRACK_SIZE[variant];
  const hitBox = hitBoxStyle(
    hitExtension(track.width, track.height, neighbourGaps(neighbourGapDp)),
  );
  const handlePress = useCallback(() => {
    onValueChange(!value);
  }, [onValueChange, value]);
  const outlined = variant === 'outlined';
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
      style={hitBox}
      onPress={handlePress}
    >
      {outlined ? (
        <View style={[styles.outlinedTrack, value && styles.outlinedTrackOn]}>
          <View style={[styles.outlinedKnob, value && styles.outlinedKnobOn]} />
        </View>
      ) : (
        <View style={[styles.track, value && styles.trackOn]}>
          <View style={[styles.knob, value && styles.knobOn]} />
        </View>
      )}
    </Pressable>
  );
}
