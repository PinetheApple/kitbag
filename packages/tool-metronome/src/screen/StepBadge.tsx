// "Every badge is a stepper" (SPEC §5.2): − value + as one shrink-wrapped
// cluster, used by the time signature, the poly ratio and the subdivision. The
// original mock drew these as inert labels, which is why "how do I change the
// time signature?" had no answer on the page.

import { radii, resolveTheme, typography } from '@kitbag/core-design';
import { useCallback, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { hitSlopFor } from '../logic/touchTargets.ts';

const theme = resolveTheme('dark');

// design §02 `.stepbadge i`: 24dp key, 7dp radius, 14px glyph, 7dp gap.
const KEY_SIZE = 24;
const KEY_RADIUS = 7;
const KEY_FONT_SIZE = 14;
const CLUSTER_GAP = 7;
const BADGE_PADDING_H = 10;
const BADGE_PADDING_V = 4;
const BADGE_FONT_SIZE = 13;
const KEY_HIT_SLOP = hitSlopFor(KEY_SIZE, CLUSTER_GAP);

const STEP_DOWN = -1;
const STEP_UP = 1;

interface StepBadgeProps {
  /** Called with -1 or +1 — the caller decides what one step of its value is. */
  readonly onStep: (delta: number) => void;
  /** Accent styling marks the poly ratio badge, as the design draws it. */
  readonly accented?: boolean;
  readonly children: ReactNode;
}

export function StepBadge({ onStep, accented, children }: StepBadgeProps) {
  const onDecrement = useCallback(() => {
    onStep(STEP_DOWN);
  }, [onStep]);
  const onIncrement = useCallback(() => {
    onStep(STEP_UP);
  }, [onStep]);

  return (
    <View style={styles.cluster}>
      <Pressable
        style={styles.key}
        hitSlop={KEY_HIT_SLOP}
        onPress={onDecrement}
      >
        <Text style={styles.keyText}>−</Text>
      </Pressable>
      <View style={[styles.badge, accented === true && styles.badgeAccented]}>
        {children}
      </View>
      <Pressable
        style={styles.key}
        hitSlop={KEY_HIT_SLOP}
        onPress={onIncrement}
      >
        <Text style={styles.keyText}>+</Text>
      </Pressable>
    </View>
  );
}

interface StepBadgeLabelProps {
  readonly children: ReactNode;
  /** Given when the badge's own face is tappable — the time signature's
   * denominator cycles a generated set rather than stepping a range. */
  readonly onPress?: () => void;
}

/** The text inside a badge, so callers do not restate the type role. */
export function StepBadgeLabel({ children, onPress }: StepBadgeLabelProps) {
  return (
    <Text style={styles.badgeText} onPress={onPress}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  cluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CLUSTER_GAP,
  },
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: KEY_RADIUS,
    backgroundColor: theme.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    color: theme.text2,
    fontFamily: typography.headline.family,
    fontSize: KEY_FONT_SIZE,
  },
  badge: {
    paddingHorizontal: BADGE_PADDING_H,
    paddingVertical: BADGE_PADDING_V,
    borderRadius: radii.chip,
    backgroundColor: theme.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
  },
  badgeAccented: {
    borderColor: theme.accent,
  },
  badgeText: {
    color: theme.text,
    fontFamily: typography.headline.family,
    fontSize: BADGE_FONT_SIZE,
    fontVariant: ['tabular-nums'],
  },
});
