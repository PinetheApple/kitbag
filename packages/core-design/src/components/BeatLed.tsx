import { useCallback, useMemo } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { opacity, size, space } from '../roles.ts';
import type { Theme } from '../theme.ts';
import { TRANSPARENT } from '../styleConstants.ts';
import { createThemedStyles, useTheme } from '../ThemeProvider.tsx';
import { ledRadius } from '../tokens.ts';
import {
  hitBoxStyle,
  hitExtension,
  neighbourGaps,
  type NeighbourGaps,
} from '../touchTarget.ts';

export type LedState = 'accented' | 'normal' | 'muted';
export type LedSize = 'main' | 'small';

export type BeatLedLayout = readonly (readonly (readonly number[])[])[];

const LED_PX: Readonly<Record<LedSize, number>> = {
  main: size.ledMain,
  small: size.ledSmall,
};

type HitBox = ReturnType<typeof hitBoxStyle>;

interface LedPosition {
  readonly first: boolean;
  readonly last: boolean;
}

function ledHitBox(
  ledSize: LedSize,
  outer: NeighbourGaps,
  row: LedPosition,
  group: LedPosition,
  led: LedPosition,
): HitBox {
  const across = (ledEdge: boolean, groupEdge: boolean, edge?: number) => {
    if (!ledEdge) return space.ledGap;
    return groupEdge ? edge : space.ledGroupGap;
  };
  return hitBoxStyle(
    hitExtension(LED_PX[ledSize], LED_PX[ledSize], {
      top: row.first ? outer.top : space.controlGap,
      bottom: row.last ? outer.bottom : space.controlGap,
      left: across(led.first, group.first, outer.left),
      right: across(led.last, group.last, outer.right),
    }),
  );
}

const INTERIOR: LedPosition = { first: false, last: false };
const DEFAULT_HIT_BOX: Readonly<Record<LedSize, HitBox>> = {
  main: ledHitBox('main', {}, INTERIOR, INTERIOR, INTERIOR),
  small: ledHitBox('small', {}, INTERIOR, INTERIOR, INTERIOR),
};

const edges = (index: number, count: number): LedPosition => ({
  first: index === 0,
  last: index === count - 1,
});

interface RestingColors {
  readonly backgroundColor: string;
  readonly borderColor: string;
}

const useStyles = createThemedStyles(() => ({
  rows: {
    gap: space.controlGap,
    alignItems: 'flex-end',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: space.ledGroupGap,
  },
  group: {
    flexDirection: 'row',
    gap: space.ledGap,
  },
  main: {
    width: size.ledMain,
    height: size.ledMain,
    borderRadius: ledRadius,
    borderWidth: size.ledMainBorder,
  },
  small: {
    width: size.ledSmall,
    height: size.ledSmall,
    borderRadius: ledRadius,
    borderWidth: size.ledSmallBorder,
  },
  muted: {
    opacity: opacity.muted,
  },
}));

function restingColors(theme: Theme, state: LedState): RestingColors {
  if (state === 'accented') {
    return { backgroundColor: TRANSPARENT, borderColor: theme.color.accent };
  }
  if (state === 'muted') {
    return { backgroundColor: TRANSPARENT, borderColor: theme.color.line };
  }
  return {
    backgroundColor: theme.color.surface2,
    borderColor: theme.color.line,
  };
}

export interface BeatLedProps {
  readonly beat: number;
  readonly state: LedState;
  readonly activeBeat: SharedValue<number>;
  readonly size?: LedSize;
  readonly accessibilityLabel: string;
  readonly onPress?: ((beat: number) => void) | undefined;
  readonly hitBox?: HitBox;
}

export function BeatLed({
  beat,
  state,
  activeBeat,
  size: ledSize = 'main',
  accessibilityLabel,
  onPress,
  hitBox,
}: BeatLedProps) {
  const theme = useTheme();
  const styles = useStyles();
  const resting = useMemo(() => restingColors(theme, state), [theme, state]);
  const lit = theme.color.accent;

  // Same keys in both branches: a key an animated style drops keeps its last
  // native value, leaving the LED lit after its beat.
  const flashStyle = useAnimatedStyle(() => {
    const sounding = Math.round(activeBeat.value) === beat;
    return {
      backgroundColor: sounding ? lit : resting.backgroundColor,
      borderColor: sounding ? lit : resting.borderColor,
    };
  });

  const handlePress = useCallback(() => {
    onPress?.(beat);
  }, [onPress, beat]);

  const led = (
    <Animated.View
      style={[
        ledSize === 'small' ? styles.small : styles.main,
        state === 'muted' ? styles.muted : null,
        flashStyle,
      ]}
    />
  );

  if (onPress === undefined) {
    return (
      <View accessible accessibilityLabel={accessibilityLabel}>
        {led}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={hitBox ?? DEFAULT_HIT_BOX[ledSize]}
      onPress={handlePress}
    >
      {led}
    </Pressable>
  );
}

export interface BeatLedRowProps {
  readonly layout: BeatLedLayout;
  readonly states: readonly LedState[];
  readonly activeBeat: SharedValue<number>;
  readonly size?: LedSize;
  readonly ledLabel: (beat: number, state: LedState) => string;
  readonly onPressBeat?: ((beat: number) => void) | undefined;
  /** Gaps from the LED block to the controls around it, for the LEDs' hit
   * boxes; a number applies to every side, an omitted side has no neighbour. */
  readonly neighbourGapDp?: number | NeighbourGaps;
}

export function BeatLedRow({
  layout,
  states,
  activeBeat,
  size: ledSize = 'main',
  ledLabel,
  onPressBeat,
  neighbourGapDp = space.controlGap,
}: BeatLedRowProps) {
  const styles = useStyles();
  const outer = neighbourGaps(neighbourGapDp);
  return (
    <View style={styles.rows}>
      {layout.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((group, groupIndex) => (
            <View key={groupIndex} style={styles.group}>
              {group.map((beat, ledIndex) => {
                const state = states[beat] ?? 'normal';
                return (
                  <BeatLed
                    key={beat}
                    beat={beat}
                    state={state}
                    activeBeat={activeBeat}
                    size={ledSize}
                    accessibilityLabel={ledLabel(beat, state)}
                    onPress={onPressBeat}
                    hitBox={ledHitBox(
                      ledSize,
                      outer,
                      edges(rowIndex, layout.length),
                      edges(groupIndex, row.length),
                      edges(ledIndex, group.length),
                    )}
                  />
                );
              })}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
