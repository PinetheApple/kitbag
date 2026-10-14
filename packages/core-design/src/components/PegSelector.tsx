import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { mix, radius, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { withAlpha } from '../theme.ts';
import { createThemedStyles, useTheme } from '../ThemeProvider.tsx';
import { minTouchTargetDp } from '../tokens.ts';
import { hitSlopFor } from '../touchTarget.ts';
import { ShapeGlyph } from './ShapeIcon.tsx';

// The design's 14dp peg gap cannot give a 48dp target without neighbours'
// slop overlapping, so the gap is the smallest that lets hitSlopFor reach 48.
const PEG_GAP = minTouchTargetDp - size.peg;
const HIT_SLOP = hitSlopFor(size.peg, PEG_GAP);
const BADGE_OFFSET = -size.pegBorder * 2;

export interface PegItem {
  readonly note: string;
  readonly stringNumber: string;
  readonly accessibilityLabel: string;
  readonly tuned: boolean;
}

export interface PegSelectorProps {
  readonly pegs: readonly PegItem[];
  readonly detectedIndex: SharedValue<number>;
  readonly lockedIndex: number | null;
  readonly onPress: (index: number) => void;
}

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: PEG_GAP,
    paddingTop: space.headstockTop,
    paddingBottom: space.headstockBottom,
  },
  peg: {
    alignItems: 'center',
    gap: space.pegLabelGap,
  },
  head: {
    width: size.peg,
    height: size.peg,
  },
  circle: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.circle,
    borderWidth: size.pegBorder,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleTuned: {
    borderColor: theme.color.green,
  },
  circleLocked: {
    backgroundColor: theme.activeControlFill,
  },
  circleDetected: {
    borderColor: theme.color.accent,
    boxShadow: `0 0 ${String(size.pegGlowBlur)}px ${withAlpha(theme.color.accent, mix.pegGlow)}`,
  },
  note: {
    ...textStyle(textRoles.pegNote),
    color: theme.color.text,
  },
  noteTuned: {
    color: theme.color.green,
  },
  noteDetected: {
    color: theme.color.accent,
  },
  badge: {
    position: 'absolute',
    right: BADGE_OFFSET,
    bottom: BADGE_OFFSET,
    width: size.pegBadge,
    height: size.pegBadge,
    borderRadius: radius.circle,
    backgroundColor: theme.color.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stringNumber: {
    ...textStyle(textRoles.pegString),
    color: theme.color.text2,
  },
  stringNumberLocked: {
    color: theme.color.accent,
  },
  lockBar: {
    width: size.pegLockBar,
    height: size.pegBorder,
    borderRadius: radius.circle,
    backgroundColor: theme.color.accent,
  },
  lockBarHidden: {
    opacity: 0,
  },
}));

interface PegProps {
  readonly index: number;
  readonly peg: PegItem;
  readonly locked: boolean;
  readonly detectedIndex: SharedValue<number>;
  readonly onPress: (index: number) => void;
}

function Peg({ index, peg, locked, detectedIndex, onPress }: PegProps) {
  const styles = useStyles();
  const theme = useTheme();

  const detectedStyle = useAnimatedStyle(() => ({
    opacity: Math.round(detectedIndex.value) === index ? 1 : 0,
  }));

  const handlePress = useCallback(() => {
    onPress(index);
  }, [onPress, index]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={peg.accessibilityLabel}
      accessibilityState={{ selected: locked }}
      hitSlop={HIT_SLOP}
      onPress={handlePress}
      style={styles.peg}
    >
      <View style={styles.head}>
        <View
          style={[
            styles.circle,
            peg.tuned && styles.circleTuned,
            locked && styles.circleLocked,
          ]}
        >
          <Text style={[styles.note, peg.tuned && styles.noteTuned]}>
            {peg.note}
          </Text>
        </View>
        <Animated.View
          style={[
            styles.circle,
            styles.circleDetected,
            peg.tuned && styles.circleTuned,
            locked && styles.circleLocked,
            detectedStyle,
          ]}
        >
          <Text
            style={[
              styles.note,
              styles.noteDetected,
              peg.tuned && styles.noteTuned,
            ]}
          >
            {peg.note}
          </Text>
        </Animated.View>
        {peg.tuned ? (
          <View style={styles.badge}>
            <ShapeGlyph
              name="check"
              px={size.pegBadgeGlyph}
              color={theme.color.bg}
            />
          </View>
        ) : null}
      </View>
      <Text style={[styles.stringNumber, locked && styles.stringNumberLocked]}>
        {peg.stringNumber}
      </Text>
      <View style={[styles.lockBar, !locked && styles.lockBarHidden]} />
    </Pressable>
  );
}

// detectedIndex is polled from the engine per frame, so it is a SharedValue;
// tuned and locked change only on a lock event or a tap, so they are props.
export function PegSelector({
  pegs,
  detectedIndex,
  lockedIndex,
  onPress,
}: PegSelectorProps) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      {pegs.map((peg, index) => (
        <Peg
          key={index}
          index={index}
          peg={peg}
          locked={index === lockedIndex}
          detectedIndex={detectedIndex}
          onPress={onPress}
        />
      ))}
    </View>
  );
}
