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
import { KITBAG_HOST_OBJECT_KEY } from '@kitbag/core-native';
import { useStemPlayer } from '@kitbag/core-state';
import { useMemo } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';

import type { HostGlobal } from './useMixerFrame.ts';

const NOT_COUNTING = 0;
const NO_BEAT = -1;

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

function CountPanel({ beats }: { readonly beats: number }) {
  const styles = useStyles();
  const currentBeat = useSharedValue(NO_BEAT);
  const counting = useSharedValue(NOT_COUNTING);
  useFrameCallback(() => {
    'worklet';
    const host = (globalThis as unknown as HostGlobal)[KITBAG_HOST_OBJECT_KEY];
    if (host === undefined) return;
    if (counting.value !== host.counting_in) counting.value = host.counting_in;
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
  const beats = useStemPlayer((s) =>
    s.advancedTo !== null && s.countEndFrame !== null
      ? s.countBeatsPerBar
      : null,
  );
  return beats === null ? null : <CountPanel beats={beats} />;
}
