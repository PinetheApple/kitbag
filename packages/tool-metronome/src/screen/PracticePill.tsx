import {
  createThemedStyles,
  hitSlopForPadded,
  InlineIcon,
  inset,
  radius,
  size,
  space,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import { practiceElapsedMs, useMetronome } from '@kitbag/core-state';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  formatPracticeElapsed,
  hasPracticeToReset,
} from '../logic/practiceTimer.ts';

const TICK_MS = 1000;

const PILL_HIT_SLOP = hitSlopForPadded(
  textRoles.chip.size,
  inset.chipV,
  Number.POSITIVE_INFINITY,
);

export interface PracticeElapsed {
  readonly elapsedMs: number;
  readonly reset: () => void;
}

const useStyles = createThemedStyles((theme) => ({
  centre: {
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.controlGap,
    paddingVertical: inset.chipV,
    paddingHorizontal: inset.chipH,
    borderRadius: radius.chip,
    backgroundColor: theme.color.surface2,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
  },
  icon: {
    ...textStyle(textRoles.chip),
    color: theme.color.text2,
  },
  elapsed: {
    ...textStyle(textRoles.chipValue),
    color: theme.color.text,
  },
  resetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.inlineKeyGap,
    paddingLeft: space.controlGap,
    borderLeftWidth: size.stroke,
    borderLeftColor: theme.color.line,
  },
  reset: {
    ...textStyle(textRoles.chipAside),
    color: theme.color.text3,
  },
}));

export function usePracticeElapsed(running: boolean): PracticeElapsed {
  const practice = useMetronome((s) => s.practice);
  const resetPractice = useMetronome((s) => s.resetPractice);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    setNow(Date.now());
    if (!running) return;
    const tick = setInterval(() => {
      setNow(Date.now());
    }, TICK_MS);
    return () => {
      clearInterval(tick);
    };
  }, [running, practice]);

  return { elapsedMs: practiceElapsedMs(practice, now), reset: resetPractice };
}

interface PracticePillProps {
  readonly elapsedMs: number;
  readonly onReset: () => void;
}

export function PracticePill({ elapsedMs, onReset }: PracticePillProps) {
  const styles = useStyles();
  const resettable = hasPracticeToReset(elapsedMs);
  return (
    <View style={styles.centre}>
      <Pressable
        accessibilityRole="button"
        {...(resettable
          ? { accessibilityHint: 'Resets the practice timer' }
          : {})}
        accessibilityState={{ disabled: !resettable }}
        disabled={!resettable}
        style={styles.pill}
        hitSlop={PILL_HIT_SLOP}
        onPress={onReset}
      >
        <InlineIcon name="practice" style={styles.icon} />
        <Text style={styles.elapsed}>{formatPracticeElapsed(elapsedMs)}</Text>
        {resettable ? (
          <View style={styles.resetRow}>
            <InlineIcon name="reset" style={styles.reset} />
            <Text style={styles.reset}>reset</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}
