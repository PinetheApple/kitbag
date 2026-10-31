import {
  createThemedStyles,
  metronome,
  radius,
  space,
  textRoles,
  textStyle,
  TRANSPARENT,
} from '@kitbag/core-design';
import { Text, View } from 'react-native';

import { dotPalette } from './beatDotStyles.ts';

const useLegendStyles = createThemedStyles((theme) => {
  const palette = dotPalette(theme.color);
  return {
    legend: {
      flexDirection: 'row',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: metronome.polyLegendGap,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.chipGap,
    },
    label: {
      ...textStyle(textRoles.polyLegend),
      color: theme.color.text2,
    },
    swatch: {
      width: metronome.polyLegendSwatch,
      height: metronome.polyLegendSwatch,
      borderRadius: radius.circle,
      backgroundColor: palette.fill,
      borderWidth: metronome.legendSwatchBorder,
      borderColor: palette.border,
    },
    cycleStart: {
      backgroundColor: TRANSPARENT,
      borderWidth: metronome.legendAccentBorder,
      borderColor: theme.color.text2,
    },
    bracket: {
      width: metronome.polyLegendBracketWidth,
      height: metronome.polyLegendBracketHeight,
      borderWidth: metronome.legendSwatchBorder,
      borderTopWidth: 0,
      borderColor: theme.color.text3,
      borderBottomLeftRadius: metronome.polyLegendBracketRadius,
      borderBottomRightRadius: metronome.polyLegendBracketRadius,
    },
  };
});

export function PolyLegend() {
  const styles = useLegendStyles();
  return (
    <View style={styles.legend}>
      <View style={styles.item}>
        <View style={[styles.swatch, styles.cycleStart]} />
        <Text style={styles.label}>cycle start</Text>
      </View>
      <View style={styles.item}>
        <View style={styles.swatch} />
        <Text style={styles.label}>poly beat</Text>
      </View>
      <View style={styles.item}>
        <View style={styles.bracket} />
        <Text style={styles.label}>one cycle</Text>
      </View>
    </View>
  );
}
