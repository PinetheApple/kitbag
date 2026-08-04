// Practice timer pill under the app bar (SPEC §5.2). Tap to reset; the ◴
// transport button is its visible twin.
//
// It ticks once a second and only while the transport runs — the pill measures
// time played, not time the screen was open. A 1 Hz clock is human-speed state,
// not a 60fps value (§13.3, §13.4).
//
// The count lives as long as the screen does. Practice time that survives
// navigation is §5.7 practiceSessions (M8), which this does not pretend to be.

import { radii, resolveTheme, typography } from '@kitbag/core-design';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatPracticeElapsed } from '../logic/practiceTimer.ts';
import { hitSlopForPadded } from '../logic/touchTargets.ts';

const theme = resolveTheme('dark');

const TICK_MS = 1000;

// design §02 `.practicebar`: pill, 5/12dp padding, 12.5px label, 11px reset.
const PILL_PADDING_V = 5;
const PILL_PADDING_H = 12;
const PILL_GAP = 8;
const LABEL_FONT_SIZE = 12.5;
const RESET_FONT_SIZE = 11;
const RESET_PADDING_LEFT = 8;
// Alone under the app bar; nothing neighbours its slop.
const PILL_HIT_SLOP = hitSlopForPadded(
  LABEL_FONT_SIZE,
  PILL_PADDING_V,
  Number.POSITIVE_INFINITY,
);

export interface PracticeElapsed {
  readonly elapsedMs: number;
  readonly reset: () => void;
}

/** Accumulated play time, ticking while `running`. */
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

const styles = StyleSheet.create({
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
    backgroundColor: theme.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
  },
  icon: {
    color: theme.text2,
    fontSize: LABEL_FONT_SIZE,
  },
  elapsed: {
    color: theme.text,
    fontFamily: typography.headline.family,
    fontSize: LABEL_FONT_SIZE,
    fontVariant: ['tabular-nums'],
  },
  reset: {
    color: theme.text3,
    fontSize: RESET_FONT_SIZE,
    paddingLeft: RESET_PADDING_LEFT,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: theme.line,
  },
});
