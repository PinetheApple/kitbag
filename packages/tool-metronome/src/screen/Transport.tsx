// Transport (design §02): the play/stop key and the ◴ practice-reset twin of
// the pill. The ≡ key the mock draws opens the setlist, which is M5 — its slot
// is held empty rather than drawn dead.

import { resolveTheme, typography } from '@kitbag/core-design';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { hitSlopFor } from '../logic/touchTargets.ts';

const theme = resolveTheme('dark');

// design §02 `.play` 58dp circle, `.tbtn` 42dp with an 11px glyph. The design
// draws play as an SVG triangle; react-native-svg is not a dependency, so the
// glyph stands in until one lands.
const PLAY_SIZE = 58;
const SECONDARY_SIZE = 42;
const PLAY_GLYPH_SIZE = 22;
const SECONDARY_GLYPH_SIZE = 11;
const ROW_GAP = 22;
const SECONDARY_HIT_SLOP = hitSlopFor(SECONDARY_SIZE, ROW_GAP);
const CIRCLE = '50%';

interface TransportProps {
  readonly running: boolean;
  readonly onToggle: () => void;
  readonly onResetPractice: () => void;
}

export function Transport({
  running,
  onToggle,
  onResetPractice,
}: TransportProps) {
  return (
    <View style={styles.row}>
      {/* The M5 setlist key's slot, reserved and inert: without it the three-key
          row of design §02 collapses to two and play sits left of centre. */}
      <View style={styles.reservedSlot} />
      <Pressable style={styles.play} onPress={onToggle}>
        <Text style={styles.playGlyph}>{running ? '■' : '▶'}</Text>
      </Pressable>
      <Pressable
        style={styles.secondary}
        hitSlop={SECONDARY_HIT_SLOP}
        onPress={onResetPractice}
      >
        <Text style={styles.secondaryGlyph}>◴</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ROW_GAP,
  },
  play: {
    width: PLAY_SIZE,
    height: PLAY_SIZE,
    borderRadius: CIRCLE,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: {
    color: theme.onAccent,
    fontSize: PLAY_GLYPH_SIZE,
  },
  reservedSlot: {
    width: SECONDARY_SIZE,
    height: SECONDARY_SIZE,
  },
  secondary: {
    width: SECONDARY_SIZE,
    height: SECONDARY_SIZE,
    borderRadius: CIRCLE,
    backgroundColor: theme.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryGlyph: {
    color: theme.text,
    fontFamily: typography.headline.family,
    fontSize: SECONDARY_GLYPH_SIZE,
  },
});
