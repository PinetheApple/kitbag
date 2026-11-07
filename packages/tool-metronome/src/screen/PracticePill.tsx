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
  hasPracticeToEnd,
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
  endRow: {
    paddingLeft: space.controlGap,
    borderLeftWidth: size.stroke,
    borderLeftColor: theme.color.line,
  },
  end: {
    ...textStyle(textRoles.chipAside),
    color: theme.color.text3,
  },
}));

export function usePracticeElapsed(): PracticeElapsed {
  const practice = useMetronome((s) => s.practice);
  const resetPractice = useMetronome((s) => s.resetPractice);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    setNow(Date.now());
    if (practice.stretchStartedAt === null) return;
    const tick = setInterval(() => {
      setNow(Date.now());
    }, TICK_MS);
    return () => {
      clearInterval(tick);
    };
  }, [practice]);

  return { elapsedMs: practiceElapsedMs(practice, now), reset: resetPractice };
}

interface PracticePillProps {
  readonly elapsedMs: number;
  readonly onEnd: () => void;
}

export function PracticePill({ elapsedMs, onEnd }: PracticePillProps) {
  const styles = useStyles();
  const endable = hasPracticeToEnd(elapsedMs);
  return (
    <View style={styles.centre}>
      <Pressable
        accessibilityRole="button"
        {...(endable
          ? {
              accessibilityLabel: `Practice ${formatPracticeElapsed(elapsedMs)}, end session`,
              accessibilityHint:
                'Ends the practice session and shows its summary',
            }
          : {})}
        accessibilityState={{ disabled: !endable }}
        disabled={!endable}
        style={styles.pill}
        hitSlop={PILL_HIT_SLOP}
        onPress={onEnd}
      >
        <InlineIcon name="practice" style={styles.icon} />
        <Text style={styles.elapsed}>{formatPracticeElapsed(elapsedMs)}</Text>
        {endable ? (
          <View style={styles.endRow}>
            <Text style={styles.end}>End</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}
