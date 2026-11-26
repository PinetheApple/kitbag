import {
  createThemedStyles,
  DrawnLiveSlot,
  Icon,
  metronome,
  TRANSPARENT,
  useTheme,
} from '@kitbag/core-design';
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
  type StatusRows,
} from '../logic/statusRows.ts';
import { mutedCellStyles } from './mutedCellStyles.ts';
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
  ...mutedCellStyles(
    metronome.cycleCellBorder,
    metronome.cycleCellRadius,
    theme.color.text2,
  ),
  now: {
    position: 'absolute',
    top: -OUTLINE_REACH,
    right: -OUTLINE_REACH,
    bottom: -OUTLINE_REACH,
    left: -OUTLINE_REACH,
    borderRadius: metronome.cycleCellRadius + OUTLINE_REACH,
    borderWidth: metronome.cycleNowOutline,
  },
}));

const MUTED_LEAD = 'Muted bar';
const PLAYING_LEAD = 'Playing';

interface CycleCellProps {
  readonly cell: number;
  readonly position: SharedValue<number>;
  readonly playBars: number;
  readonly cycle: number;
}

function CycleCell({ cell, position, playBars, cycle }: CycleCellProps) {
  const styles = useCycleStyles();
  const { color } = useTheme();
  const bar = useDerivedValue(() => cycleCellBar(cell, position.value, cycle));
  const play = useAnimatedStyle(() => {
    const ink =
      bar.value >= 0 && bar.value < playBars ? color.text2 : TRANSPARENT;
    return { backgroundColor: ink, borderColor: ink };
  });
  const mute = useAnimatedStyle(() => ({
    borderColor: bar.value >= playBars ? color.text2 : TRANSPARENT,
  }));
  const now = useAnimatedStyle(() => ({
    borderColor:
      bar.value >= 0 && bar.value === position.value ? color.text : TRANSPARENT,
  }));
  return (
    <View style={styles.cell}>
      <Animated.View style={[styles.face, play]} />
      <Animated.View style={[styles.mutedOutline, mute]} />
      <Animated.View style={[styles.mutedEnds, mute]} />
      <Animated.View style={[styles.now, now]} />
    </View>
  );
}

interface MuteStatusProps {
  readonly rows: SharedValue<StatusRows>;
  readonly barMuted: SharedValue<number>;
  readonly barMutePosition: SharedValue<number>;
  readonly barMute: BarMuteConfig;
}

export function MuteStatus({
  rows,
  barMuted,
  barMutePosition,
  barMute,
}: MuteStatusProps) {
  const styles = useStatusStyles();
  const cycleStyles = useCycleStyles();
  const { color } = useTheme();
  const cycle = barMute.playBars + barMute.muteBars;
  const position = useDerivedValue(() => ofText(barMutePosition.value, cycle));
  const lead = useDerivedValue<string>(() =>
    barMuted.value === 0 ? PLAYING_LEAD : MUTED_LEAD,
  );
  const cells = Array.from({ length: cycleStripCells(cycle) }, (_u, i) => i);
  return (
    <StatusVariant rows={rows} shown="mute" style={styles.live}>
      <Icon name="muteBars" size="statusLive" color="text2" />
      <DrawnLiveSlot
        text={lead}
        role="statusLead"
        widest={MUTED_LEAD}
        color={color.text}
        textStyle={styles.lead}
      />
      <DrawnLiveSlot
        text={position}
        role="statusMeta"
        widest={ofText(cycle - 1, cycle)}
        color={color.text2}
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
