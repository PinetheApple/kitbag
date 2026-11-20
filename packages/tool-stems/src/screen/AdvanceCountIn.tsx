import {
  CountSquare,
  createThemedStyles,
  metronome,
  radii,
  size,
  space,
  stemPlayer,
  stemPlayerMix,
  withAlpha,
} from '@kitbag/core-design';
import { KB_STOPPED_BEAT, KITBAG_HOST_OBJECT_KEY } from '@kitbag/core-native';
import { useStemPlayer } from '@kitbag/core-state';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { HostGlobal } from './useMixerFrame.ts';

const NOT_COUNTING = 0;

const useStyles = createThemedStyles((theme) => ({
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: stemPlayer.countPanelGap,
    marginHorizontal: space.screenInset,
    padding: stemPlayer.countPanelPadding,
    borderRadius: radii.card,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: withAlpha(theme.color.bg, stemPlayerMix.countPanel),
  },
}));

interface CountPanelProps {
  readonly beats: number;
  readonly onOver: () => void;
}

function CountPanel({ beats, onOver }: CountPanelProps) {
  const styles = useStyles();
  const currentBeat = useSharedValue(KB_STOPPED_BEAT);
  const counting = useSharedValue(NOT_COUNTING);
  useFrameCallback(() => {
    'worklet';
    const host = (globalThis as unknown as HostGlobal)[KITBAG_HOST_OBJECT_KEY];
    if (host === undefined) return;
    const now = host.counting_in;
    if (counting.value !== NOT_COUNTING && now === NOT_COUNTING)
      scheduleOnRN(onOver);
    if (counting.value !== now) counting.value = now;
    if (currentBeat.value !== host.current_beat)
      currentBeat.value = host.current_beat;
  });
  const shown = useAnimatedStyle(() => ({
    opacity: counting.value === NOT_COUNTING ? 0 : 1,
  }));
  const squares = useMemo(
    () => Array.from({ length: beats }, (_, beat) => beat),
    [beats],
  );
  return (
    <View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      style={styles.layer}
    >
      <Animated.View style={[styles.panel, shown]}>
        {squares.map((beat) => (
          <CountSquare
            key={beat}
            beat={beat}
            side={metronome.countSquare}
            currentBeat={currentBeat}
          />
        ))}
      </Animated.View>
    </View>
  );
}

export function AdvanceCountIn() {
  const count = useStemPlayer((s) =>
    s.advanceCountEnd !== null && s.countEndFrame === s.advanceCountEnd
      ? s.advanceCountEnd
      : null,
  );
  const beats = useStemPlayer((s) => s.countBeatsPerBar);
  const [over, setOver] = useState<number | null>(null);
  const finish = useCallback(() => {
    setOver(count);
  }, [count]);
  if (count === null || over === count) return null;
  return <CountPanel beats={beats} onOver={finish} />;
}
