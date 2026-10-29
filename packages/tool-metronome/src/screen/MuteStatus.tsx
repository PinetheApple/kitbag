import { createThemedStyles, Icon, metronome } from '@kitbag/core-design';
import type { BarMuteConfig } from '@kitbag/core-state';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';

import {
  cycleCellBar,
  cycleStripCells,
  ofText,
  type StatusMode,
} from '../logic/statusLine.ts';
import { LiveSlot } from './LiveSlot.tsx';
import { useStatusStyles } from './statusStyles.ts';
import { StatusVariant } from './StatusVariant.tsx';

const OUTLINE_REACH = metronome.cycleNowOffset + metronome.cycleNowOutline;

const useCycleStyles = createThemedStyles((theme) => ({
  strip: {
    flexDirection: 'row',
    gap: metronome.cycleCellGap,
    marginLeft: 'auto',
    flexShrink: 1,
  },
  cell: {
    width: metronome.cycleCellWidth,
    height: metronome.cycleCellHeight,
    flexShrink: 1,
  },
  face: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: metronome.cycleCellRadius,
    borderWidth: metronome.cycleCellBorder,
  },
  play: {
    backgroundColor: theme.color.text2,
    borderColor: theme.color.text2,
  },
  mute: {
    borderColor: theme.color.text2,
    borderStyle: 'dashed',
  },
  now: {
    position: 'absolute',
    top: -OUTLINE_REACH,
    right: -OUTLINE_REACH,
    bottom: -OUTLINE_REACH,
    left: -OUTLINE_REACH,
    borderRadius: metronome.cycleCellRadius + OUTLINE_REACH,
    borderWidth: metronome.cycleNowOutline,
    borderColor: theme.color.text,
  },
  stack: {
    justifyContent: 'center',
  },
  overlay: {
    position: 'absolute',
    left: 0,
  },
}));

interface CycleCellProps {
  readonly cell: number;
  readonly position: SharedValue<number>;
  readonly playBars: number;
  readonly cycle: number;
}

function CycleCell({ cell, position, playBars, cycle }: CycleCellProps) {
  const styles = useCycleStyles();
  const bar = useDerivedValue(() => cycleCellBar(cell, position.value, cycle));
  const play = useAnimatedStyle(() => ({
    opacity: bar.value >= 0 && bar.value < playBars ? 1 : 0,
  }));
  const mute = useAnimatedStyle(() => ({
    opacity: bar.value >= playBars ? 1 : 0,
  }));
  const now = useAnimatedStyle(() => ({
    opacity: bar.value >= 0 && bar.value === position.value ? 1 : 0,
  }));
  return (
    <View style={styles.cell}>
      <Animated.View style={[styles.face, styles.play, play]} />
      <Animated.View style={[styles.face, styles.mute, mute]} />
      <Animated.View style={[styles.now, now]} />
    </View>
  );
}

interface MuteStatusProps {
  readonly mode: SharedValue<StatusMode>;
  readonly barMuted: SharedValue<number>;
  readonly barMutePosition: SharedValue<number>;
  readonly barMute: BarMuteConfig;
}

export function MuteStatus({
  mode,
  barMuted,
  barMutePosition,
  barMute,
}: MuteStatusProps) {
  const styles = useStatusStyles();
  const cycleStyles = useCycleStyles();
  const cycle = barMute.playBars + barMute.muteBars;
  const position = useDerivedValue(() => ofText(barMutePosition.value, cycle));
  const muted = useAnimatedStyle(() => ({
    opacity: barMuted.value === 0 ? 0 : 1,
  }));
  const playing = useAnimatedStyle(() => ({
    opacity: barMuted.value === 0 ? 1 : 0,
  }));
  const cells = Array.from({ length: cycleStripCells(cycle) }, (_u, i) => i);
  return (
    <StatusVariant mode={mode} shown="mute" style={styles.live}>
      <Icon name="muteBars" size="statusLive" color="text2" />
      <View style={cycleStyles.stack}>
        <Animated.Text style={[styles.lead, muted]}>Muted bar</Animated.Text>
        <Animated.Text style={[styles.lead, cycleStyles.overlay, playing]}>
          Playing
        </Animated.Text>
      </View>
      <LiveSlot
        text={position}
        role="statusMeta"
        widest={ofText(cycle - 1, cycle)}
        textStyle={styles.meta}
        style={styles.metaGap}
      />
      <View style={cycleStyles.strip}>
        {cells.map((cell) => (
          <CycleCell
            key={cell}
            cell={cell}
            position={barMutePosition}
            playBars={barMute.playBars}
            cycle={cycle}
          />
        ))}
      </View>
    </StatusVariant>
  );
}
