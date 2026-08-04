// Transport (design §02): the play/stop key and the ◴ practice-reset twin of
// the pill. The ≡ key the mock draws opens the setlist, which is M5 — it is not
// drawn here rather than drawn dead.

import { resolveTheme, typography } from '@kitbag/core-design';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { hitSlopFor } from '../logic/touchTargets.ts';

const theme = resolveTheme('dark');

// design §02 `.play` 58dp circle, `.tbtn` 42dp.
const PLAY_SIZE = 58;
const SECONDARY_SIZE = 42;
const PLAY_GLYPH_SIZE = 22;
const SECONDARY_GLYPH_SIZE = 15;
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
      <Pressable style={styles.play} onPress={onToggle}>
        <Text style={styles.playGlyph}>{running ? '■' : '▶'}</Text>
      </Pressable>
      {/* ◴ keeps the right-hand slot design §02 gives it; the left slot's ≡
          opens the setlist, which is M5. */}
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
