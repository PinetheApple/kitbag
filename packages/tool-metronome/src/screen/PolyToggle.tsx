// "Poly stays a toggle segment beside the subdivision stepper" (SPEC §5.2) —
// its ratio is edited on the poly row's own stepper, so the segment only has to
// answer on/off.

import { resolveTheme, typography } from '@kitbag/core-design';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { hitSlopForPadded } from '../logic/touchTargets.ts';

const theme = resolveTheme('dark');

// design §02 `.seg`: 11dp radius, 3dp padding, 12.5px label, 8dp inner radius.
const SEGMENT_RADIUS = 11;
const SEGMENT_PADDING = 3;
const OPTION_RADIUS = 8;
const OPTION_PADDING_V = 6;
const OPTION_PADDING_H = 4;
const LABEL_FONT_SIZE = 12.5;
// The only control in its segment, so nothing neighbours its slop.
const OPTION_HIT_SLOP = hitSlopForPadded(
  LABEL_FONT_SIZE,
  OPTION_PADDING_V,
  Number.POSITIVE_INFINITY,
);

interface PolyToggleProps {
  readonly enabled: boolean;
  readonly onToggle: () => void;
}

export function PolyToggle({ enabled, onToggle }: PolyToggleProps) {
  return (
    <View style={styles.segment}>
      <Pressable
        style={[styles.option, enabled && styles.optionOn]}
        hitSlop={OPTION_HIT_SLOP}
        onPress={onToggle}
      >
        <Text style={[styles.label, enabled && styles.labelOn]}>poly</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    borderRadius: SEGMENT_RADIUS,
    backgroundColor: theme.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    padding: SEGMENT_PADDING,
  },
  option: {
    paddingVertical: OPTION_PADDING_V,
    paddingHorizontal: OPTION_PADDING_H,
    borderRadius: OPTION_RADIUS,
  },
  optionOn: {
    backgroundColor: theme.surface3,
  },
  label: {
    color: theme.text2,
    fontFamily: typography.headline.family,
    fontSize: LABEL_FONT_SIZE,
  },
  labelOn: {
    color: theme.accent,
  },
});
