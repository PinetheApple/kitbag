import { Text, View } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import {
  FIRST_STRIP_BEAT,
  isStripDownbeat,
  stripPlayheadFraction,
  stripWindowStart,
} from '../beatStripWindow.ts';
import { manualTempo } from '../manualTempoRoles.ts';
import { asPercent } from '../percent.ts';
import { size, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';

const BAR_ONE_LABEL = '1';
const BEAT_MARK = manualTempo.beatMark;
const DOWNBEAT_MARK = manualTempo.downbeatMark;
const SLOTS = Array.from(
  { length: manualTempo.stripBeats },
  (_u, slot) => slot,
);

const useStyles = createThemedStyles((theme) => ({
  strip: {
    height: manualTempo.stripHeight,
    flexDirection: 'row',
    borderRadius: manualTempo.stripRadius,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface2,
    overflow: 'hidden',
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: manualTempo.markBottom,
  },
  beat: { width: manualTempo.markStroke, backgroundColor: theme.color.text },
  barOne: {
    ...textStyle(textRoles.polyStripCaption),
    position: 'absolute',
    left: '50%',
    marginLeft: manualTempo.barOneLabelLeft,
    bottom: manualTempo.barOneLabelBottom,
    color: theme.color.text2,
  },
  label: {
    ...textStyle(textRoles.chipAside),
    position: 'absolute',
    left: manualTempo.stripLabelLeft,
    top: manualTempo.stripLabelTop,
    color: theme.color.text2,
  },
  playhead: {
    position: 'absolute',
    top: manualTempo.playheadTop,
    bottom: manualTempo.playheadBottom,
    width: manualTempo.markStroke,
    marginLeft: -manualTempo.markStroke / 2,
    backgroundColor: theme.color[theme.accentInk],
  },
}));

export interface BeatStripProps {
  readonly beatsPerBar: number;
  readonly beatsFromBarOne: SharedValue<number>;
  readonly label: string;
}

interface SlotProps {
  readonly slot: number;
  readonly beatsPerBar: number;
  readonly windowStart: SharedValue<number>;
}

function StripSlot({ slot, beatsPerBar, windowStart }: SlotProps) {
  const styles = useStyles();
  const markStyle = useAnimatedStyle(() => ({
    height: isStripDownbeat(windowStart.value + slot, beatsPerBar)
      ? DOWNBEAT_MARK
      : BEAT_MARK,
  }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: windowStart.value + slot === 0 ? 1 : 0,
  }));
  return (
    <View style={styles.slot}>
      <Animated.View style={[styles.beat, markStyle]} />
      <Animated.Text style={[styles.barOne, labelStyle]}>
        {BAR_ONE_LABEL}
      </Animated.Text>
    </View>
  );
}

export function BeatStrip({
  beatsPerBar,
  beatsFromBarOne,
  label,
}: BeatStripProps) {
  const styles = useStyles();
  const windowStart = useSharedValue(FIRST_STRIP_BEAT);
  useAnimatedReaction(
    () => beatsFromBarOne.value,
    (beat) => {
      windowStart.value = stripWindowStart(windowStart.value, beat);
    },
  );
  const playheadStyle = useAnimatedStyle(() => ({
    left: asPercent(
      stripPlayheadFraction(windowStart.value, beatsFromBarOne.value),
    ),
  }));
  return (
    <View accessible accessibilityLabel={label} style={styles.strip}>
      {SLOTS.map((slot) => (
        <StripSlot
          key={slot}
          slot={slot}
          beatsPerBar={beatsPerBar}
          windowStart={windowStart}
        />
      ))}
      <Text style={styles.label}>{label}</Text>
      <Animated.View style={[styles.playhead, playheadStyle]} />
    </View>
  );
}
