import {
  asPercent,
  createThemedStyles,
  metronomeSheet,
  radius,
  space,
  textRoles,
  textStyle,
  TRANSPARENT,
} from '@kitbag/core-design';
import { effectivePolyAgainst } from '@kitbag/core-state';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { polyStripCaption } from '../logic/polyRow.ts';

const useStripStyles = createThemedStyles((theme) => ({
  strip: {
    gap: metronomeSheet.polyStripGap,
    paddingVertical: metronomeSheet.polyStripPadV,
  },
  beatLane: {
    flexDirection: 'row',
    height: metronomeSheet.polyStripLane,
    gap: space.barPreviewGap,
    paddingLeft: metronomeSheet.polyStripBarStart,
    paddingRight: metronomeSheet.polyStripBarEnd,
  },
  beat: {
    flex: 1,
    borderRadius: radius.barPreview,
    backgroundColor: theme.color.text2,
  },
  polyLane: {
    height: metronomeSheet.polyStripLane,
    marginRight: metronomeSheet.polyStripDot,
  },
  pulse: {
    position: 'absolute',
    top: 0,
    width: metronomeSheet.polyStripDot,
    height: metronomeSheet.polyStripDot,
    borderRadius: radius.circle,
    backgroundColor: theme.color.accent,
  },
  first: {
    backgroundColor: TRANSPARENT,
    borderWidth: metronomeSheet.polyStripRing,
    borderColor: theme.color.accent,
  },
  caption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  captionText: {
    ...textStyle(textRoles.polyStripCaption),
    color: theme.color.text3,
  },
}));

interface PolyStripProps {
  readonly polyBeats: number;
  readonly against: number;
  readonly beatsPerBar: number;
}

export function PolyStrip({ polyBeats, against, beatsPerBar }: PolyStripProps) {
  const styles = useStripStyles();
  const mainBeats = effectivePolyAgainst(against, beatsPerBar);
  const caption = polyStripCaption(polyBeats, against, beatsPerBar);
  const pulses = useMemo(
    () =>
      Array.from({ length: polyBeats }, (_u, k) => ({
        left: asPercent(k / polyBeats),
      })),
    [polyBeats],
  );
  return (
    <View
      style={styles.strip}
      accessible
      accessibilityLabel={`${caption.cycle}, ${caption.span}`}
    >
      <View style={styles.beatLane}>
        {Array.from({ length: mainBeats }, (_u, beat) => (
          <View key={beat} style={styles.beat} />
        ))}
      </View>
      <View style={styles.polyLane}>
        {pulses.map((place, k) => (
          <View
            key={k}
            style={[styles.pulse, k === 0 && styles.first, place]}
          />
        ))}
      </View>
      <View style={styles.caption}>
        <Text style={styles.captionText}>{caption.cycle}</Text>
        <Text style={styles.captionText}>{caption.span}</Text>
      </View>
    </View>
  );
}
