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
import { BPM_BOUNDS } from '@kitbag/core-state';
import { useCallback, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
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
  compact: metronome.tempoNumeralCompact,
};

const NUMERAL_MAX_SCALE: Readonly<Record<ScreenDensity, number | undefined>> = {
  roomy: undefined,
  compact: metronome.tempoNumeralScaledMax / NUMERAL_SIZE.compact,
};

const ARROW_SHORTFALL = minTouchTargetDp - iconSizes.chevron;

const TIGHT_NUMERAL = { fontSize: metronome.tempoNumeralTight };
const TIGHT_NUMERAL_MAX_SCALE =
  metronome.tempoNumeralCompact / metronome.tempoNumeralTight;
const WIDEST_BPM = String(BPM_BOUNDS.max);
const TIGHT_ARROW_REACH: Readonly<Insets> = {
  top: ARROW_SHORTFALL / 2,
  bottom: ARROW_SHORTFALL / 2,
};

// Each 13dp chevron's 48dp target takes the zone padding beside it; the rest
// overlaps the readout or caption, and zIndex lets the arrow win there.
function arrowReach(
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

const ARROW_REACH: Readonly<
  Record<ScreenDensity, Readonly<Record<TempoArrow, Insets>>>
> = {
  roomy: arrowReach('roomy'),
  compact: arrowReach('compact'),
};

const ARROW_LABEL: Readonly<Record<TempoArrow, string>> = {
  up: 'Increase tempo',
  down: 'Decrease tempo',
};

interface SwipeTempoZoneProps {
  readonly bpm: number;
  readonly density: ScreenDensity;
  readonly tight: boolean;
  readonly swipeAnywhere: boolean;
  readonly currentBpm: SharedValue<number>;
  readonly barPhase: SharedValue<number>;
  readonly onTypeTempo: () => void;
  readonly onNudge: (delta: number) => void;
}

interface TempoArrowKeyProps {
  readonly arrow: TempoArrow;
  readonly reach: Insets;
  readonly tight?: boolean;
  readonly onNudge: (delta: number) => void;
}

const useStyles = createThemedStyles((theme) => ({
  zone: {
    borderRadius: radius.tempoZone,
  },
  tightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    alignSelf: 'center',
    alignItems: 'center',
    minWidth: minTouchTargetDp,
    zIndex: 1,
  },
  tightArrow: {
    width: minTouchTargetDp,
  },
  ghost: {
    opacity: 0,
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

function TempoArrowKey({
  arrow,
  reach,
  tight = false,
  onNudge,
}: TempoArrowKeyProps) {
  const styles = useStyles();
  const handlePress = useCallback(() => {
    onNudge(tempoArrowDelta(arrow));
  }, [arrow, onNudge]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={ARROW_LABEL[arrow]}
      style={[styles.arrow, tight && styles.tightArrow]}
      hitSlop={reach}
      onPress={handlePress}
    >
      <Icon
        name={arrow === 'up' ? 'caretUp' : 'caretDown'}
        size="chevron"
        color="decor"
      />
    </Pressable>
  );
}

function tempoCaption(bpm: number, swipeAnywhere: boolean): string {
  const caption = `BPM · ${tempoMarking(bpm)}`;
  return swipeAnywhere ? `${caption} · SWIPE ANYWHERE` : caption;
}

export function SwipeTempoZone({
  bpm,
  density,
  tight,
  swipeAnywhere,
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
    () => (tight ? TIGHT_NUMERAL : { fontSize: NUMERAL_SIZE[density] }),
    [tight, density],
  );
  const maxScale = tight ? TIGHT_NUMERAL_MAX_SCALE : NUMERAL_MAX_SCALE[density];
  // `text` is the channel an animated TextInput redraws from without a render.
  const readout = useAnimatedProps(() => {
    const text = Math.round(currentBpm.value).toString();
    return { text, defaultValue: text } as unknown as Partial<TextInputProps>;
  });
  const input = (
    <AnimatedTextInput
      editable={false}
      underlineColorAndroid="transparent"
      maxFontSizeMultiplier={maxScale}
      style={[styles.bpm, numeral, tight && StyleSheet.absoluteFill]}
      animatedProps={readout}
    />
  );
  const reading = (
    <Pressable
      style={styles.readout}
      accessibilityRole="button"
      accessibilityLabel="Tempo"
      accessibilityHint="Type a tempo"
      accessibilityValue={{ text: `${String(bpm)} BPM` }}
      onPress={onTypeTempo}
    >
      {tight ? (
        <Text
          accessibilityLabel="dbg:tempo-ghost"
          maxFontSizeMultiplier={maxScale}
          style={[styles.bpm, numeral, styles.ghost]}
          importantForAccessibility="no"
          accessibilityElementsHidden
        >
          {WIDEST_BPM}
        </Text>
      ) : null}
      {input}
    </Pressable>
  );
  const caption = (
    <Text accessibilityLabel="dbg:tempo-caption" style={styles.sub}>
      {tempoCaption(bpm, swipeAnywhere)}
    </Text>
  );
  const sweep = <BarSweep barPhase={barPhase} gap={SWEEP_GAP[density]} />;
  if (tight) {
    return (
      <View style={[styles.zone, zonePadding]}>
        <View style={styles.tightRow}>
          <TempoArrowKey
            arrow="down"
            reach={TIGHT_ARROW_REACH}
            tight
            onNudge={onNudge}
          />
          {reading}
          <TempoArrowKey
            arrow="up"
            reach={TIGHT_ARROW_REACH}
            tight
            onNudge={onNudge}
          />
        </View>
        {caption}
        {sweep}
      </View>
    );
  }
  return (
    <View style={[styles.zone, zonePadding]}>
      <TempoArrowKey
        arrow="up"
        reach={ARROW_REACH[density].up}
        onNudge={onNudge}
      />
      {reading}
      {caption}
      <TempoArrowKey
        arrow="down"
        reach={ARROW_REACH[density].down}
        onNudge={onNudge}
      />
      {sweep}
    </View>
  );
}
