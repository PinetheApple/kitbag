// The tempo readout (SPEC §5.2, design §02 `.swipezone`): the number, its tempo
// marking, the chevrons that hint at the drag, and the bar sweep under it.
// Tapping the number opens the numpad. The drag itself belongs to the whole
// screen — see useTempoSwipe — and the §12.6 one-time hint that teaches both
// gestures is not built here.

import { resolveTheme, typography } from '@kitbag/core-design';
import { StyleSheet, Text, View } from 'react-native';
import { type SharedValue } from 'react-native-reanimated';

import { tempoMarking } from '../logic/tempoMarking.ts';
import { BarSweep } from './BarSweep.tsx';
import { DISPLAY_WEIGHT } from './typeStyles.ts';

const theme = resolveTheme('dark');

// design §02 `.swipezone`: 88px numeral, 11px tracked sub-label, 18dp radius.
const BPM_FONT_SIZE = 88;
const SUB_FONT_SIZE = 11;
// §12.2 records label tracking as an em fraction; RN wants absolute dp.
const SUB_TRACKING = SUB_FONT_SIZE * (typography.label.tracking ?? 0);
const CHEVRON_FONT_SIZE = 13;
const ZONE_RADIUS = 18;
const ZONE_PADDING_TOP = 26;
const ZONE_PADDING_BOTTOM = 18;
// The design's glow is a radial `color-mix(ac 5%, transparent)`. RN has no
// radial gradients and no gradient dependency here, so it is a flat 5% tint.
const ZONE_GLOW_MIX = 0.05;
const ALPHA_MAX = 255;
const HEX_RADIX = 16;
const HEX_PAIR = 2;
const ZONE_GLOW = `${theme.accent}${Math.round(ALPHA_MAX * ZONE_GLOW_MIX)
  .toString(HEX_RADIX)
  .padStart(HEX_PAIR, '0')}`;

interface SwipeTempoZoneProps {
  readonly bpm: number;
  readonly barPhase: SharedValue<number>;
  readonly onTypeTempo: () => void;
}

export function SwipeTempoZone({
  bpm,
  barPhase,
  onTypeTempo,
}: SwipeTempoZoneProps) {
  return (
    <View style={styles.zone}>
      <Text style={styles.chevron}>⌃</Text>
      <Text style={styles.bpm} onPress={onTypeTempo}>
        {bpm}
      </Text>
      <Text style={styles.sub}>BPM · {tempoMarking(bpm)} · SWIPE ANYWHERE</Text>
      <Text style={styles.chevron}>⌄</Text>
      <BarSweep barPhase={barPhase} />
    </View>
  );
}

const styles = StyleSheet.create({
  zone: {
    borderRadius: ZONE_RADIUS,
    backgroundColor: ZONE_GLOW,
    paddingTop: ZONE_PADDING_TOP,
    paddingBottom: ZONE_PADDING_BOTTOM,
  },
  chevron: {
    color: theme.text3,
    fontSize: CHEVRON_FONT_SIZE,
    textAlign: 'center',
  },
  bpm: {
    color: theme.text,
    fontFamily: typography.display.family,
    fontWeight: DISPLAY_WEIGHT,
    fontSize: BPM_FONT_SIZE,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  sub: {
    color: theme.text2,
    fontFamily: typography.label.family,
    fontSize: SUB_FONT_SIZE,
    letterSpacing: SUB_TRACKING,
    textAlign: 'center',
  },
});
