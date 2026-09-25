import {
  createThemedStyles,
  iconSizes,
  icons,
  inset,
  mix,
  radius,
  textRoles,
  textStyle,
  typography,
} from '@kitbag/core-design';
import { Text, View } from 'react-native';
import { type SharedValue } from 'react-native-reanimated';

import { tempoMarking } from '../logic/tempoMarking.ts';
import { BarSweep } from './BarSweep.tsx';

const BPM_FONT_SIZE = 88;
const ALPHA_MAX = 255;
const HEX_RADIX = 16;
const HEX_PAIR = 2;
const GLOW_ALPHA = Math.round(ALPHA_MAX * mix.tempoZoneGlow)
  .toString(HEX_RADIX)
  .padStart(HEX_PAIR, '0');

interface SwipeTempoZoneProps {
  readonly bpm: number;
  readonly barPhase: SharedValue<number>;
  readonly onTypeTempo: () => void;
}

const useStyles = createThemedStyles((theme) => ({
  zone: {
    borderRadius: radius.tempoZone,
    experimental_backgroundImage: `radial-gradient(120% 90% at 50% 50%, ${theme.color.accent}${GLOW_ALPHA}, transparent 70%)`,
    paddingTop: inset.tempoZoneTop,
    paddingBottom: inset.tempoZoneBottom,
  },
  chevron: {
    color: theme.color.text3,
    fontSize: iconSizes.chevron,
    textAlign: 'center',
  },
  bpm: {
    ...textStyle(typography.display),
    fontSize: BPM_FONT_SIZE,
    fontVariant: ['tabular-nums'],
    color: theme.color.text,
    textAlign: 'center',
  },
  sub: {
    ...textStyle(textRoles.tempoCaption),
    color: theme.color.text2,
    textAlign: 'center',
  },
}));

export function SwipeTempoZone({
  bpm,
  barPhase,
  onTypeTempo,
}: SwipeTempoZoneProps) {
  const styles = useStyles();
  return (
    <View style={styles.zone}>
      <Text style={styles.chevron}>{icons.caretUp}</Text>
      <Text style={styles.bpm} onPress={onTypeTempo}>
        {bpm}
      </Text>
      <Text style={styles.sub}>BPM · {tempoMarking(bpm)} · SWIPE ANYWHERE</Text>
      <Text style={styles.chevron}>{icons.caretDown}</Text>
      <BarSweep barPhase={barPhase} />
    </View>
  );
}
