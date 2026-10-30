import {
  createThemedStyles,
  Icon,
  iconSizes,
  inset,
  metronome,
  minTouchTargetDp,
  radius,
  size,
  space,
  textRoles,
  textStyle,
  typography,
} from '@kitbag/core-design';
import { useCallback, useMemo } from 'react';
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

import type { ScreenDensity } from '../logic/screenDensity.ts';
import { tempoArrowDelta, type TempoArrow } from '../logic/tempoArrows.ts';
import { tempoMarking } from '../logic/tempoMarking.ts';
import { BarSweep } from './BarSweep.tsx';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const ZONE_PADDING: Readonly<
  Record<ScreenDensity, { readonly top: number; readonly bottom: number }>
> = {
  roomy: { top: inset.tempoZoneTop, bottom: inset.tempoZoneBottom },
  compact: {
    top: inset.tempoZoneTopCompact,
    bottom: inset.tempoZoneBottomCompact,
  },
};

const SWEEP_GAP: Readonly<Record<ScreenDensity, number>> = {
  roomy: space.sectionGap,
  compact: metronome.bodyGapCompact,
};

const NUMERAL_SIZE: Readonly<Record<ScreenDensity, number>> = {
  roomy: metronome.tempoNumeral,
  compact: typography.display.size,
};

const ARROW_SHORTFALL = minTouchTargetDp - iconSizes.chevron;

// Each 13dp chevron's 48dp target takes the zone padding beside it; the rest
// overlaps the readout or caption, and zIndex lets the arrow win there.
function arrowHitSlop(
  density: ScreenDensity,
): Readonly<Record<TempoArrow, Insets>> {
  const roomAboveUp = ZONE_PADDING[density].top;
  const roomBelowDown =
    SWEEP_GAP[density] + size.sweepTrack + ZONE_PADDING[density].bottom;
  return {
    up: {
      top: roomAboveUp,
      bottom: Math.max(0, ARROW_SHORTFALL - roomAboveUp),
    },
    down: {
      top: Math.max(0, ARROW_SHORTFALL - roomBelowDown),
      bottom: roomBelowDown,
    },
  };
}

const ARROW_HIT_SLOP: Readonly<
  Record<ScreenDensity, Readonly<Record<TempoArrow, Insets>>>
> = {
  roomy: arrowHitSlop('roomy'),
  compact: arrowHitSlop('compact'),
};

const ARROW_LABEL: Readonly<Record<TempoArrow, string>> = {
  up: 'Increase tempo',
  down: 'Decrease tempo',
};

interface SwipeTempoZoneProps {
  readonly bpm: number;
  readonly density: ScreenDensity;
  readonly currentBpm: SharedValue<number>;
  readonly barPhase: SharedValue<number>;
  readonly onTypeTempo: () => void;
  readonly onNudge: (delta: number) => void;
}

interface TempoArrowKeyProps {
  readonly arrow: TempoArrow;
  readonly density: ScreenDensity;
  readonly onNudge: (delta: number) => void;
}

const useStyles = createThemedStyles((theme) => ({
  zone: {
    borderRadius: radius.tempoZone,
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
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
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

function TempoArrowKey({ arrow, density, onNudge }: TempoArrowKeyProps) {
  const styles = useStyles();
  const handlePress = useCallback(() => {
    onNudge(tempoArrowDelta(arrow));
  }, [arrow, onNudge]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={ARROW_LABEL[arrow]}
      style={styles.arrow}
      hitSlop={ARROW_HIT_SLOP[density][arrow]}
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
  density,
  currentBpm,
  barPhase,
  onTypeTempo,
  onNudge,
}: SwipeTempoZoneProps) {
  const styles = useStyles();
  const zonePadding = useMemo(
    () => ({
      paddingTop: ZONE_PADDING[density].top,
      paddingBottom: ZONE_PADDING[density].bottom,
    }),
    [density],
  );
  const numeral = useMemo(
    () => ({ fontSize: NUMERAL_SIZE[density] }),
    [density],
  );
  // `text` is the channel an animated TextInput redraws from without a render.
  const readout = useAnimatedProps(() => {
    const text = Math.round(currentBpm.value).toString();
    return { text, defaultValue: text } as unknown as Partial<TextInputProps>;
  });
  return (
    <View style={[styles.zone, zonePadding]}>
      <TempoArrowKey arrow="up" density={density} onNudge={onNudge} />
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
          style={[styles.bpm, numeral]}
          animatedProps={readout}
        />
      </Pressable>
      <Text style={styles.sub}>BPM · {tempoMarking(bpm)} · SWIPE ANYWHERE</Text>
      <TempoArrowKey arrow="down" density={density} onNudge={onNudge} />
      <BarSweep barPhase={barPhase} gap={SWEEP_GAP[density]} />
    </View>
  );
}
