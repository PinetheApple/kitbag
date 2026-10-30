import { useCallback } from 'react';
import { Pressable, View } from 'react-native';

import { radius, size, space } from '../roles.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import {
  hitBoxStyle,
  hitExtension,
  neighbourGaps,
  type NeighbourGaps,
} from '../touchTarget.ts';

const KNOB_TRAVEL = size.switchWidth - size.switchKnob - size.switchKnobInset;

export interface SwitchProps {
  readonly value: boolean;
  readonly onValueChange: (value: boolean) => void;
  readonly accessibilityLabel: string;
  /** Gaps to the controls around the track, for the 48dp hit box; a number
   * applies to every side, an omitted side has no neighbour. */
  readonly neighbourGapDp?: number | NeighbourGaps;
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
}));

export function Switch({
  value,
  onValueChange,
  accessibilityLabel,
  neighbourGapDp = space.controlGap,
}: SwitchProps) {
  const styles = useStyles();
  const hitBox = hitBoxStyle(
    hitExtension(
      size.switchWidth,
      size.switchHeight,
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
      style={hitBox}
      onPress={handlePress}
    >
      <View style={[styles.track, value && styles.trackOn]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </View>
    </Pressable>
  );
}
