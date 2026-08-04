// The preset steppers (SPEC §5.2): −10 / −5 / TAP / +5 / +10 in one
// thumb-height row. This is the visible fallback that teaches nothing and needs
// no teaching — swipe-anywhere is the hidden gesture, this row always works.

import { resolveTheme, typography } from '@kitbag/core-design';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { hitSlopForPadded } from '../logic/touchTargets.ts';

const theme = resolveTheme('dark');

// design §02 `.preset`: 11dp radius, 9dp vertical padding, 13.5px label; the
// TAP key is wider (flex 1.3) and toned.
const KEY_RADIUS = 11;
const KEY_PADDING_V = 12;
const KEY_FONT_SIZE = 13.5;
const ROW_GAP = 8;
const KEY_HIT_SLOP = hitSlopForPadded(KEY_FONT_SIZE, KEY_PADDING_V, ROW_GAP);
const TAP_FLEX = 1.3;
const TAP_FONT_WEIGHT = '700';

// SPEC §5.2 names the row: −10 / −5 / TAP / +5 / +10.
const FINE_NUDGE = 5;
const COARSE_NUDGE = 10;
const NUDGES = [-COARSE_NUDGE, -FINE_NUDGE, FINE_NUDGE, COARSE_NUDGE] as const;
const TAP_INSERT_INDEX = NUDGES.length / 2;

interface NudgeKeyProps {
  readonly delta: number;
  readonly onNudge: (delta: number) => void;
}

function NudgeKey({ delta, onNudge }: NudgeKeyProps) {
  const handlePress = useCallback(() => {
    onNudge(delta);
  }, [onNudge, delta]);

  const label = delta > 0 ? `+${String(delta)}` : String(delta);

  return (
    <Pressable style={styles.key} hitSlop={KEY_HIT_SLOP} onPress={handlePress}>
      <Text style={styles.keyText}>{label}</Text>
    </Pressable>
  );
}

interface PresetRowProps {
  readonly onNudge: (delta: number) => void;
  readonly onTap: () => void;
}

export function PresetRow({ onNudge, onTap }: PresetRowProps) {
  return (
    <View style={styles.row}>
      {NUDGES.slice(0, TAP_INSERT_INDEX).map((delta) => (
        <NudgeKey key={delta} delta={delta} onNudge={onNudge} />
      ))}
      <Pressable
        style={[styles.key, styles.tapKey]}
        hitSlop={KEY_HIT_SLOP}
        onPress={onTap}
      >
        <Text style={[styles.keyText, styles.tapKeyText]}>TAP</Text>
      </Pressable>
      {NUDGES.slice(TAP_INSERT_INDEX).map((delta) => (
        <NudgeKey key={delta} delta={delta} onNudge={onNudge} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: ROW_GAP,
  },
  key: {
    flex: 1,
    paddingVertical: KEY_PADDING_V,
    borderRadius: KEY_RADIUS,
    backgroundColor: theme.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    alignItems: 'center',
  },
  keyText: {
    color: theme.text,
    fontFamily: typography.headline.family,
    fontSize: KEY_FONT_SIZE,
    fontVariant: ['tabular-nums'],
  },
  tapKey: {
    flex: TAP_FLEX,
    borderColor: theme.accentDim,
  },
  tapKeyText: {
    color: theme.accent,
    fontWeight: TAP_FONT_WEIGHT,
  },
});
