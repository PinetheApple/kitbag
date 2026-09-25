import { createThemedStyles, textStyle, typography } from '@kitbag/core-design';
import { Text, View } from 'react-native';
import { type SharedValue } from 'react-native-reanimated';

import { tempoMarking } from '../logic/tempoMarking.ts';
import { BarSweep } from './BarSweep.tsx';

const BPM_FONT_SIZE = 88;
const SUB_FONT_SIZE = 11;
const SUB_TRACKING = SUB_FONT_SIZE * (typography.label.tracking ?? 0);
const CHEVRON_FONT_SIZE = 13;
const ZONE_RADIUS = 18;
const ZONE_PADDING_TOP = 26;
const ZONE_PADDING_BOTTOM = 18;
// The design's radial glow, flattened: RN has no radial gradient.
const ZONE_GLOW_MIX = 0.05;
const ALPHA_MAX = 255;
const HEX_RADIX = 16;
const HEX_PAIR = 2;
const ZONE_GLOW_ALPHA = Math.round(ALPHA_MAX * ZONE_GLOW_MIX)
  .toString(HEX_RADIX)
  .padStart(HEX_PAIR, '0');

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
  const styles = useStyles();
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

const useStyles = createThemedStyles((theme) => ({
  zone: {
    borderRadius: ZONE_RADIUS,
    backgroundColor: `${theme.color.accent}${ZONE_GLOW_ALPHA}`,
    paddingTop: ZONE_PADDING_TOP,
    paddingBottom: ZONE_PADDING_BOTTOM,
  },
  chevron: {
    color: theme.color.text3,
    fontSize: CHEVRON_FONT_SIZE,
    textAlign: 'center',
  },
  bpm: {
    color: theme.color.text,
    fontFamily: typography.display.family,
    fontWeight: textStyle(typography.display).fontWeight,
    fontSize: BPM_FONT_SIZE,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  sub: {
    color: theme.color.text2,
    fontFamily: typography.label.family,
    fontSize: SUB_FONT_SIZE,
    letterSpacing: SUB_TRACKING,
    textAlign: 'center',
  },
}));
