import {
  createThemedStyles,
  Icon,
  metronome,
  minTouchTargetDp,
  NotationGlyph,
  radius,
  size,
  space,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import { Pressable, Text, View } from 'react-native';

import { meterLabel, spokenMeter } from '../logic/meter.ts';
import { subdivisionName } from '../logic/subdivision.ts';

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.rowGap,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.chipGap,
    minHeight: minTouchTargetDp,
    paddingRight: metronome.pickerChipRight,
    borderRadius: radius.button,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface2,
  },
  meter: {
    minWidth: metronome.meterChipMin,
    paddingLeft: metronome.meterChipLeft,
  },
  subdivision: {
    minWidth: metronome.subdivisionChipMin,
    paddingLeft: metronome.subdivisionChipLeft,
  },
  label: {
    ...textStyle(textRoles.pickerChip),
    color: theme.color.text,
    flexGrow: 1,
    flexShrink: 1,
  },
}));

interface PickerChipsProps {
  readonly beatsPerBar: number;
  readonly denominator: number;
  readonly subdivision: number;
  readonly onOpenMeter: () => void;
  readonly onOpenSubdivision: () => void;
}

export function PickerChips({
  beatsPerBar,
  denominator,
  subdivision,
  onOpenMeter,
  onOpenSubdivision,
}: PickerChipsProps) {
  const styles = useStyles();
  const meter = { beats: beatsPerBar, denominator };
  const name = subdivisionName(subdivision, denominator);
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Time signature, ${spokenMeter(meter)}`}
        accessibilityHint="Changes the time signature"
        style={[styles.chip, styles.meter]}
        onPress={onOpenMeter}
      >
        <Text style={styles.label}>{meterLabel(meter)}</Text>
        <Icon name="caretDown" size="caret" color="text3" />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Subdivision, ${name}`}
        accessibilityHint="Changes the subdivision"
        style={[styles.chip, styles.subdivision]}
        onPress={onOpenSubdivision}
      >
        <NotationGlyph
          subdivision={subdivision}
          height={metronome.notationChip}
        />
        <Text style={styles.label}>{name}</Text>
        <Icon name="caretDown" size="caret" color="text3" />
      </Pressable>
    </View>
  );
}
