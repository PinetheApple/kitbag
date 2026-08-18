// The LEDs ARE the editor (SPEC §5.2): tap a beat to cycle accent → normal →
// mute, no separate edit mode. Ring = accent, filled = sounding now, dim =
// muted. Rows group and wrap per D9 — the arithmetic is in logic/ledLayout.
//
// The flash is realtime: each LED reads currentBeat in useAnimatedStyle on the
// UI thread (§13.3). The accent state is human-speed React state from the store.

import { ledRadius, resolveTheme } from '@kitbag/core-design';
import { KB_ACCENT } from '@kitbag/core-native';
import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { layoutBeatLeds } from '../logic/ledLayout.ts';
import { hitSlopFor } from '../logic/touchTargets.ts';

const theme = resolveTheme('dark');

// design §02: `.led` 26px with a 2px border, `.led.sm` 16px with 1.5px — the
// poly row's smaller LEDs (§5.2).
const LED_SIZE = 26;
const LED_BORDER = 2;
const LED_SIZE_SMALL = 16;
const LED_BORDER_SMALL = 1.5;
const MUTED_OPACITY = 0.4;
const GROUP_GAP = 9;
const BETWEEN_GROUPS_GAP = 18;
const ROW_GAP = 8;
// Bounded by the gap to the next LED, not by the 48dp target — see hitSlopFor.
// Rows wrap (D9), so the vertical gap between rows bounds it as much as the
// horizontal gap within a group.
const LED_NEIGHBOUR_GAP = Math.min(GROUP_GAP, ROW_GAP);
const LED_HIT_SLOP = hitSlopFor(LED_SIZE, LED_NEIGHBOUR_GAP);
const LED_HIT_SLOP_SMALL = hitSlopFor(LED_SIZE_SMALL, LED_NEIGHBOUR_GAP);

// Ring = accent, plain = normal, dim = muted (SPEC §5.2). Returned as values
// rather than styles because the flash worklet must hand back the same keys on
// both branches — see Led.
function restingColors(accent: KB_ACCENT): {
  backgroundColor: string;
  borderColor: string;
} {
  if (accent === KB_ACCENT.KB_ACCENT_ACCENTED) {
    return { backgroundColor: 'transparent', borderColor: theme.accent };
  }
  if (accent === KB_ACCENT.KB_ACCENT_MUTED) {
    return { backgroundColor: 'transparent', borderColor: theme.line };
  }
  return { backgroundColor: theme.surface2, borderColor: theme.line };
}

interface LedProps {
  readonly beat: number;
  readonly accent: KB_ACCENT;
  readonly currentBeat: SharedValue<number>;
  readonly small?: boolean | undefined;
  readonly onCycle?: ((beat: number) => void) | undefined;
}

function Led({ beat, accent, currentBeat, small, onCycle }: LedProps) {
  // Memoised: the worklet captures this object, so a fresh one per render would
  // rebuild every LED's animated style on any unrelated store change.
  const resting = useMemo(() => restingColors(accent), [accent]);

  // Both branches return the SAME keys: an animated style that drops a property
  // leaves the last applied native value in place, which would stick an LED lit
  // after its beat passed. gate/LedRow.tsx holds the same rule.
  const flashStyle = useAnimatedStyle(() => {
    const sounding = Math.round(currentBeat.value) === beat;
    return {
      backgroundColor: sounding ? theme.accent : resting.backgroundColor,
      borderColor: sounding ? theme.accent : resting.borderColor,
    };
  });

  // Named handler per LED (no inline arrows in JSX props); `beat` is the only
  // thing that varies, so the identity is stable across a flash.
  const handlePress = useCallback(() => {
    onCycle?.(beat);
  }, [onCycle, beat]);

  const shape = small === true ? styles.ledSmall : styles.led;
  const dimmed = accent === KB_ACCENT.KB_ACCENT_MUTED ? styles.ledMuted : null;

  const led = <Animated.View style={[shape, dimmed, flashStyle]} />;
  if (onCycle === undefined) return led;

  return (
    <Pressable
      hitSlop={small === true ? LED_HIT_SLOP_SMALL : LED_HIT_SLOP}
      onPress={handlePress}
    >
      {led}
    </Pressable>
  );
}

interface BeatLedsProps {
  readonly beatCount: number;
  readonly accents: readonly KB_ACCENT[];
  readonly currentBeat: SharedValue<number>;
  readonly small?: boolean | undefined;
  /** Omitted on a row that is not editable (the poly row has no accent ABI). */
  readonly onCycle?: ((beat: number) => void) | undefined;
}

export function BeatLeds({
  beatCount,
  accents,
  currentBeat,
  small,
  onCycle,
}: BeatLedsProps) {
  return (
    <View style={styles.rows}>
      {layoutBeatLeds(beatCount).map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((group, groupIndex) => (
            <View key={groupIndex} style={styles.group}>
              {group.map((beat) => (
                <Led
                  key={beat}
                  beat={beat}
                  accent={accents[beat] ?? KB_ACCENT.KB_ACCENT_NORMAL}
                  currentBeat={currentBeat}
                  small={small}
                  onCycle={onCycle}
                />
              ))}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rows: {
    gap: ROW_GAP,
    alignItems: 'flex-end',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: BETWEEN_GROUPS_GAP,
  },
  group: {
    flexDirection: 'row',
    gap: GROUP_GAP,
  },
  led: {
    width: LED_SIZE,
    height: LED_SIZE,
    borderRadius: ledRadius,
    borderWidth: LED_BORDER,
  },
  ledSmall: {
    width: LED_SIZE_SMALL,
    height: LED_SIZE_SMALL,
    borderRadius: ledRadius,
    borderWidth: LED_BORDER_SMALL,
  },
  // Colour comes from the flash worklet (restingColors); only the dimming a
  // muted beat keeps whether or not it is sounding lives here.
  ledMuted: {
    opacity: MUTED_OPACITY,
  },
});
