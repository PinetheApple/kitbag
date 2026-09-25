import {
  createThemedStyles,
  hitSlopForPadded,
  icons,
  inset,
  radius,
  size,
  space,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatPracticeElapsed } from '../logic/practiceTimer.ts';

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
  reset: {
    ...textStyle(textRoles.chipAside),
    color: theme.color.text3,
    paddingLeft: space.controlGap,
    borderLeftWidth: size.stroke,
    borderLeftColor: theme.color.line,
  },
}));

export function usePracticeElapsed(running: boolean): PracticeElapsed {
  const [elapsedMs, setElapsedMs] = useState(0);
  const playedMs = useRef(0);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!running) {
      if (startedAt.current !== null) {
        playedMs.current += Date.now() - startedAt.current;
        startedAt.current = null;
        setElapsedMs(playedMs.current);
      }
      return;
    }

    const startOfStretch = Date.now();
    startedAt.current = startOfStretch;
    setElapsedMs(playedMs.current);
    const tick = setInterval(() => {
      const start = startedAt.current;
      setElapsedMs(
        playedMs.current + (start === null ? 0 : Date.now() - start),
      );
    }, TICK_MS);
    return () => {
      clearInterval(tick);
      // Also runs on unmount, where the stop branch above never does.
      if (startedAt.current !== null) {
        playedMs.current += Date.now() - startedAt.current;
        startedAt.current = null;
      }
    };
  }, [running]);

  const reset = useCallback(() => {
    playedMs.current = 0;
    startedAt.current = running ? Date.now() : null;
    setElapsedMs(0);
  }, [running]);

  return { elapsedMs, reset };
}

interface PracticePillProps {
  readonly elapsedMs: number;
  readonly onReset: () => void;
}

export function PracticePill({ elapsedMs, onReset }: PracticePillProps) {
  const styles = useStyles();
  return (
    <View style={styles.centre}>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Resets the practice timer"
        style={styles.pill}
        hitSlop={PILL_HIT_SLOP}
        onPress={onReset}
      >
        <Text style={styles.icon}>{icons.practice}</Text>
        <Text style={styles.elapsed}>{formatPracticeElapsed(elapsedMs)}</Text>
        <Text style={styles.reset}>{icons.reset} reset</Text>
      </Pressable>
    </View>
  );
}
