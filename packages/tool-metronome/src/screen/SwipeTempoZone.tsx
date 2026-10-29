import {
  createThemedStyles,
  Icon,
  iconSizes,
  inset,
  minTouchTargetDp,
  radius,
  size,
  space,
  textRoles,
  textStyle,
  typography,
} from '@kitbag/core-design';
import { useCallback } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
  type Insets,
  type TextInputProps,
} from 'react-native';
import Animated, {
  useAnimatedProps,
  type SharedValue,
} from 'react-native-reanimated';

import { tempoArrowDelta, type TempoArrow } from '../logic/tempoArrows.ts';
import { tempoMarking } from '../logic/tempoMarking.ts';
import { BarSweep } from './BarSweep.tsx';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const BPM_FONT_SIZE = 88;

// The chevrons draw at the design's 13dp, so each arrow's 48dp target is made
// of the free space around it: the zone's top padding above ▲, and the bar
// sweep's gap, track and the zone's bottom padding below ▼. The remainder
// overlaps the readout's line box (▲, 9dp) or the caption's (▼, 2dp); zIndex
// lets the arrow win those overlaps, and the sweep below ▼.
const ARROW_ROOM_ABOVE_UP = inset.tempoZoneTop;
const ARROW_ROOM_BELOW_DOWN =
  space.sectionGap + size.sweepTrack + inset.tempoZoneBottom;
const ARROW_SHORTFALL = minTouchTargetDp - iconSizes.chevron;

const ARROW_HIT_SLOP: Readonly<Record<TempoArrow, Insets>> = {
  up: {
    top: ARROW_ROOM_ABOVE_UP,
    bottom: Math.max(0, ARROW_SHORTFALL - ARROW_ROOM_ABOVE_UP),
  },
  down: {
    top: Math.max(0, ARROW_SHORTFALL - ARROW_ROOM_BELOW_DOWN),
    bottom: ARROW_ROOM_BELOW_DOWN,
  },
};

const ARROW_LABEL: Readonly<Record<TempoArrow, string>> = {
  up: 'Increase tempo',
  down: 'Decrease tempo',
};

interface SwipeTempoZoneProps {
  readonly bpm: number;
  readonly currentBpm: SharedValue<number>;
  readonly barPhase: SharedValue<number>;
  readonly onTypeTempo: () => void;
  readonly onNudge: (delta: number) => void;
}

interface TempoArrowKeyProps {
  readonly arrow: TempoArrow;
  readonly onNudge: (delta: number) => void;
}

const useStyles = createThemedStyles((theme) => ({
  zone: {
    borderRadius: radius.tempoZone,
    paddingTop: inset.tempoZoneTop,
    paddingBottom: inset.tempoZoneBottom,
  },
  arrow: {
    alignSelf: 'center',
    alignItems: 'center',
    minWidth: minTouchTargetDp,
    zIndex: 1,
  },
  // A TextInput claims every touch that lands on it natively, ignoring its own
  // pointerEvents, and that claim cancels the screen's tempo pan (#125).
  // box-only makes the Pressable intercept before the TextInput sees it.
  readout: {
    pointerEvents: 'box-only',
  },
  bpm: {
    ...textStyle(typography.display),
    fontSize: BPM_FONT_SIZE,
    fontVariant: ['tabular-nums'],
    color: theme.color.text,
    textAlign: 'center',
    padding: 0,
  },
  sub: {
    ...textStyle(textRoles.tempoCaption),
    color: theme.color.text2,
    textAlign: 'center',
  },
}));

function TempoArrowKey({ arrow, onNudge }: TempoArrowKeyProps) {
  const styles = useStyles();
  const handlePress = useCallback(() => {
    onNudge(tempoArrowDelta(arrow));
  }, [arrow, onNudge]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={ARROW_LABEL[arrow]}
      style={styles.arrow}
      hitSlop={ARROW_HIT_SLOP[arrow]}
      onPress={handlePress}
    >
      <Icon
        name={arrow === 'up' ? 'caretUp' : 'caretDown'}
        size="chevron"
        color="text3"
      />
    </Pressable>
  );
}

export function SwipeTempoZone({
  bpm,
  currentBpm,
  barPhase,
  onTypeTempo,
  onNudge,
}: SwipeTempoZoneProps) {
  const styles = useStyles();
  // `text` is the channel an animated TextInput redraws from without a render.
  const readout = useAnimatedProps(() => {
    const text = Math.round(currentBpm.value).toString();
    return { text, defaultValue: text } as unknown as Partial<TextInputProps>;
  });
  return (
    <View style={styles.zone}>
      <TempoArrowKey arrow="up" onNudge={onNudge} />
      <Pressable
        style={styles.readout}
        accessibilityRole="button"
        accessibilityLabel="Tempo"
        accessibilityHint="Type a tempo"
        accessibilityValue={{ text: `${String(bpm)} BPM` }}
        onPress={onTypeTempo}
      >
        <AnimatedTextInput
          editable={false}
          underlineColorAndroid="transparent"
          style={styles.bpm}
          animatedProps={readout}
        />
      </Pressable>
      <Text style={styles.sub}>BPM · {tempoMarking(bpm)} · SWIPE ANYWHERE</Text>
      <TempoArrowKey arrow="down" onNudge={onNudge} />
      <BarSweep barPhase={barPhase} />
    </View>
  );
}
