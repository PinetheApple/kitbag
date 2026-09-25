import { useCallback, useMemo } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { opacity, size, space } from '../roles.ts';
import type { Theme } from '../theme.ts';
import { createThemedStyles, useTheme } from '../ThemeProvider.tsx';
import { ledRadius } from '../tokens.ts';
import { hitSlopFor } from '../touchTarget.ts';

export type LedState = 'accented' | 'normal' | 'muted';
export type LedSize = 'main' | 'small';

export type BeatLedLayout = readonly (readonly (readonly number[])[])[];

const TRANSPARENT = 'transparent';

// Rows wrap, so the row gap bounds the slop as much as the gap within a group.
const LED_NEIGHBOUR_GAP = Math.min(space.ledGap, space.controlGap);
const HIT_SLOP: Readonly<Record<LedSize, number>> = {
  main: hitSlopFor(size.ledMain, LED_NEIGHBOUR_GAP),
  small: hitSlopFor(size.ledSmall, LED_NEIGHBOUR_GAP),
};

interface RestingColors {
  readonly backgroundColor: string;
  readonly borderColor: string;
}

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
}

export function BeatLed({
  beat,
  state,
  activeBeat,
  size: ledSize = 'main',
  accessibilityLabel,
  onPress,
}: BeatLedProps) {
  const theme = useTheme();
  const styles = useStyles();
  const resting = useMemo(() => restingColors(theme, state), [theme, state]);
  const lit = theme.color.accent;

  // Both branches return the same keys: a key an animated style drops keeps
  // its last native value, which would leave the LED lit after its beat.
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
      hitSlop={HIT_SLOP[ledSize]}
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
}

export function BeatLedRow({
  layout,
  states,
  activeBeat,
  size: ledSize = 'main',
  ledLabel,
  onPressBeat,
}: BeatLedRowProps) {
  const styles = useStyles();
  return (
    <View style={styles.rows}>
      {layout.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((group, groupIndex) => (
            <View key={groupIndex} style={styles.group}>
              {group.map((beat) => {
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
