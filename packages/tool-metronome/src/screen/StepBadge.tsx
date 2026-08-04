// "Every badge is a stepper" (SPEC §5.2): − value + as one shrink-wrapped
// cluster, used by the time signature, the poly ratio and the subdivision. The
// original mock drew these as inert labels, which is why "how do I change the
// time signature?" had no answer on the page.

import { resolveTheme, typography } from '@kitbag/core-design';
import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { hitSlopFor } from '../logic/touchTargets.ts';

const theme = resolveTheme('dark');

// design §02 `.stepbadge i`: 24dp key, 7dp radius, 14px glyph, 7dp gap.
const KEY_SIZE = 24;
const KEY_RADIUS = 7;
const KEY_FONT_SIZE = 14;
const CLUSTER_GAP = 7;
// design §02 `.badge2`: 10.5px tracked label, 2/7dp padding, 6dp radius.
const BADGE_PADDING_H = 7;
const BADGE_PADDING_V = 2;
const BADGE_FONT_SIZE = 10.5;
const BADGE_RADIUS = 6;
const BADGE_TRACKING_EM = 0.06;
const BADGE_TRACKING = BADGE_FONT_SIZE * BADGE_TRACKING_EM;
const KEY_HIT_SLOP = hitSlopFor(KEY_SIZE, CLUSTER_GAP);

const STEP_DOWN = -1;
const STEP_UP = 1;

// `.badge2.acc` recolours the label, not just the border, so the label reads
// the cluster's accent state rather than each caller restating it.
const AccentedContext = createContext(false);

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
        <AccentedContext.Provider value={accented === true}>
          {children}
        </AccentedContext.Provider>
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
  const accented = useContext(AccentedContext);

  return (
    <Text
      style={[styles.badgeText, accented && styles.badgeTextAccented]}
      onPress={onPress}
    >
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
    borderRadius: BADGE_RADIUS,
    backgroundColor: theme.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
  },
  badgeAccented: {
    borderColor: theme.accentDim,
  },
  badgeText: {
    color: theme.text2,
    fontFamily: typography.headline.family,
    fontSize: BADGE_FONT_SIZE,
    letterSpacing: BADGE_TRACKING,
    fontVariant: ['tabular-nums'],
  },
  badgeTextAccented: {
    color: theme.accent,
  },
});
