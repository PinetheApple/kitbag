import { useCallback } from 'react';
import { Pressable, View } from 'react-native';

import { switchA11y, switchHitBox, switchStyles } from '../switch.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import type { NeighbourGaps } from '../touchTarget.ts';

const useStyles = createThemedStyles(switchStyles);

export interface SwitchProps {
  readonly value: boolean;
  readonly onValueChange: (value: boolean) => void;
  readonly accessibilityLabel: string;
  readonly neighbourGapDp?: number | NeighbourGaps;
}

export function SwitchTrack({ value }: { readonly value: boolean }) {
  const styles = useStyles();
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
  neighbourGapDp,
}: SwitchProps) {
  const hitBox = switchHitBox(neighbourGapDp);
  const handlePress = useCallback(() => {
    onValueChange(!value);
  }, [onValueChange, value]);
  return (
    <Pressable
      {...switchA11y(value)}
      accessibilityLabel={accessibilityLabel}
      style={hitBox}
      onPress={handlePress}
    >
      <SwitchTrack value={value} />
    </Pressable>
  );
}
