import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { manualTempo } from '../manualTempoRoles.ts';
import { asPercent } from '../percent.ts';
import { size, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';

const BEAT_CENTRE = 0.5;
const BAR_ONE_LABEL = '1';
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
  beat: {
    width: manualTempo.markStroke,
    height: manualTempo.beatMark,
    backgroundColor: theme.color.text,
  },
  downbeat: { height: manualTempo.downbeatMark },
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

const beatOfSlot = (slot: number) => slot - manualTempo.stripBeatsBeforeBarOne;

function isDownbeat(slot: number, beatsPerBar: number): boolean {
  const beat = beatOfSlot(slot);
  return ((beat % beatsPerBar) + beatsPerBar) % beatsPerBar === 0;
}

export function BeatStrip({
  beatsPerBar,
  beatsFromBarOne,
  label,
}: BeatStripProps) {
  const styles = useStyles();
  const playheadStyle = useAnimatedStyle(() => {
    const fraction =
      (beatsFromBarOne.value +
        manualTempo.stripBeatsBeforeBarOne +
        BEAT_CENTRE) /
      manualTempo.stripBeats;
    return {
      left: asPercent(fraction),
      opacity: fraction >= 0 && fraction <= 1 ? 1 : 0,
    };
  });
  return (
    <View accessible accessibilityLabel={label} style={styles.strip}>
      {SLOTS.map((slot) => (
        <View key={slot} style={styles.slot}>
          <View
            style={[
              styles.beat,
              isDownbeat(slot, beatsPerBar) && styles.downbeat,
            ]}
          />
          {beatOfSlot(slot) === 0 ? (
            <Text style={styles.barOne}>{BAR_ONE_LABEL}</Text>
          ) : null}
        </View>
      ))}
      <Text style={styles.label}>{label}</Text>
      <Animated.View style={[styles.playhead, playheadStyle]} />
    </View>
  );
}
