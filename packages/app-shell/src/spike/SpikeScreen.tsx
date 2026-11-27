import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { SPIKE_MARKER } from './registry';

const TRAVEL_PX = 240;
const SWEEP_MS = 1000;
const MS_PER_SECOND = 1000;
const TARGET_FPS = 60;
const FLUSH_MS = MS_PER_SECOND;
const FRAME_BUDGET_MS = MS_PER_SECOND / TARGET_FPS;
const LONG_FRAME_MS = FRAME_BUDGET_MS * 2;
const STARVE_BLOCK_MS = 200;
const STARVE_PERIOD_MS = 250;
const BOX_SIZE = 48;
const GAP = 16;

const FIXED_DIGITS = 2;
const NOT_STARTED = -1;

interface FrameStats {
  frames: number;
  sumMs: number;
  maxMs: number;
  overBudget: number;
  overLong: number;
  lastFlushMs: number;
}

const EMPTY_STATS: FrameStats = {
  frames: 0,
  sumMs: 0,
  maxMs: 0,
  overBudget: 0,
  overLong: 0,
  lastFlushMs: NOT_STARTED,
};

export interface SpikeScreenProps {
  readonly variant: string;
  readonly boxColor: string;
  readonly textColor: string;
  readonly starve: boolean;
}

function logFrameStats(label: string, stats: FrameStats): void {
  const meanMs = (stats.sumMs / stats.frames).toFixed(FIXED_DIGITS);
  console.log(
    `${SPIKE_MARKER} frames variant=${label} frames=${String(stats.frames)} meanMs=${meanMs} maxMs=${stats.maxMs.toFixed(FIXED_DIGITS)} over16.7=${String(stats.overBudget)} over33.3=${String(stats.overLong)}`,
  );
}

function blockJsThread(): number {
  const startedMs = Date.now();
  const end = startedMs + STARVE_BLOCK_MS;
  while (Date.now() < end);
  return Date.now() - startedMs;
}

function startStarving(): () => void {
  let blocks = 0;
  const block = () => {
    const blockedMs = blockJsThread();
    blocks += 1;
    console.log(
      `${SPIKE_MARKER} block ran n=${String(blocks)} ms=${String(blockedMs)}`,
    );
  };
  const id = setInterval(block, STARVE_PERIOD_MS);
  return () => {
    clearInterval(id);
  };
}

export function SpikeScreen({
  variant,
  boxColor,
  textColor,
  starve,
}: SpikeScreenProps) {
  const offset = useSharedValue(0);
  const stats = useSharedValue<FrameStats>({ ...EMPTY_STATS });
  const label = `${variant} starve=${String(starve)}`;

  useEffect(() => {
    offset.value = withRepeat(
      withTiming(TRAVEL_PX, { duration: SWEEP_MS, easing: Easing.linear }),
      -1,
      true,
    );
  }, [offset]);

  useEffect(() => {
    if (!starve) return undefined;
    return startStarving();
  }, [starve]);

  useFrameCallback((frame) => {
    const delta = frame.timeSincePreviousFrame;
    if (delta === null) return;
    stats.modify((s) => {
      'worklet';
      if (s.lastFlushMs === NOT_STARTED) {
        s.lastFlushMs = frame.timestamp;
        return s;
      }
      s.frames += 1;
      s.sumMs += delta;
      s.maxMs = Math.max(s.maxMs, delta);
      if (delta > FRAME_BUDGET_MS) s.overBudget += 1;
      if (delta > LONG_FRAME_MS) s.overLong += 1;
      if (frame.timestamp - s.lastFlushMs >= FLUSH_MS) {
        scheduleOnRN(logFrameStats, label, { ...s });
        s.frames = 0;
        s.sumMs = 0;
        s.maxMs = 0;
        s.overBudget = 0;
        s.overLong = 0;
        s.lastFlushMs = frame.timestamp;
      }
      return s;
    });
  });

  const boxStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  return (
    <View style={styles.root}>
      <Text style={{ color: textColor }}>{variant}</Text>
      <Animated.View
        style={[styles.box, { backgroundColor: boxColor }, boxStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: GAP, gap: GAP },
  box: { width: BOX_SIZE, height: BOX_SIZE },
});
