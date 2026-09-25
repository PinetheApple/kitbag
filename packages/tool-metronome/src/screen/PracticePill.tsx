import {
  hitSlopForPadded,
  radii,
  createThemedStyles,
  typography,
} from '@kitbag/core-design';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatPracticeElapsed } from '../logic/practiceTimer.ts';

const TICK_MS = 1000;

const PILL_PADDING_V = 5;
const PILL_PADDING_H = 12;
const PILL_GAP = 8;
const LABEL_FONT_SIZE = 12.5;
const RESET_FONT_SIZE = 11;
const RESET_PADDING_LEFT = 8;
const PILL_HIT_SLOP = hitSlopForPadded(
  LABEL_FONT_SIZE,
  PILL_PADDING_V,
  Number.POSITIVE_INFINITY,
);

export interface PracticeElapsed {
  readonly elapsedMs: number;
  readonly reset: () => void;
}

export function usePracticeElapsed(running: boolean): PracticeElapsed {
  const [elapsedMs, setElapsedMs] = useState(0);
  const playedMs = useRef(0);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!running) {
      // Stopping banks the stretch just played, so a resume continues the
      // session rather than restarting it.
      if (startedAt.current !== null) {
        playedMs.current += Date.now() - startedAt.current;
        startedAt.current = null;
        setElapsedMs(playedMs.current);
      }
      return;
    }

    const startOfStretch = Date.now();
    startedAt.current = startOfStretch;
    // The first tick is a second away; without this the pill shows the previous
    // value for up to a second after ▶.
    setElapsedMs(playedMs.current);
    const tick = setInterval(() => {
      const start = startedAt.current;
      setElapsedMs(
        playedMs.current + (start === null ? 0 : Date.now() - start),
      );
    }, TICK_MS);
    return () => {
      clearInterval(tick);
      // Bank the stretch: the cleanup also runs on unmount, where the effect
      // body's stop branch never gets to.
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
      <Pressable style={styles.pill} hitSlop={PILL_HIT_SLOP} onPress={onReset}>
        <Text style={styles.icon}>◴</Text>
        <Text style={styles.elapsed}>{formatPracticeElapsed(elapsedMs)}</Text>
        <Text style={styles.reset}>↺ reset</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createThemedStyles((theme) => ({
  centre: {
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PILL_GAP,
    paddingVertical: PILL_PADDING_V,
    paddingHorizontal: PILL_PADDING_H,
    borderRadius: radii.chip,
    backgroundColor: theme.color.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.line,
  },
  icon: {
    color: theme.color.text2,
    fontSize: LABEL_FONT_SIZE,
  },
  elapsed: {
    color: theme.color.text,
    fontFamily: typography.headline.family,
    fontSize: LABEL_FONT_SIZE,
    fontVariant: ['tabular-nums'],
  },
  reset: {
    color: theme.color.text3,
    fontSize: RESET_FONT_SIZE,
    paddingLeft: RESET_PADDING_LEFT,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: theme.color.line,
  },
}));
