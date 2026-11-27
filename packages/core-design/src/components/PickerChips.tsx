import { Pressable, Text, View } from 'react-native';

import { metronome } from '../metronomeRoles.ts';
import { radius, size, space, textRoles } from '../roles.ts';
import { subdivisionName } from '../subdivisionText.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { spokenTimeSignature, timeSignatureLabel } from '../timeSignature.ts';
import { minTouchTargetDp } from '../tokens.ts';
import { hitBoxStyle, hitExtension } from '../touchTarget.ts';
import { Icon } from './Icon.tsx';
import { NotationGlyph } from './NotationGlyph.tsx';

const CHIP_HIT_BOX = hitBoxStyle(
  hitExtension(minTouchTargetDp, metronome.pickerChip, {
    top: space.controlGap,
    bottom: metronome.controlsToDots,
  }),
);

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.rowGap,
    marginTop: space.controlGap,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.chipGap,
    minHeight: metronome.pickerChip,
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

export interface PickerChipsProps {
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
        accessibilityLabel={`Time signature, ${spokenTimeSignature(meter)}`}
        accessibilityHint="Changes the time signature"
        style={CHIP_HIT_BOX}
        onPress={onOpenMeter}
      >
        <View style={[styles.chip, styles.meter]}>
          <Text style={styles.label}>{timeSignatureLabel(meter)}</Text>
          <Icon name="caretDown" size="caret" color="decor" />
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Subdivision, ${name}`}
        accessibilityHint="Changes the subdivision"
        style={CHIP_HIT_BOX}
        onPress={onOpenSubdivision}
      >
        <View style={[styles.chip, styles.subdivision]}>
          <NotationGlyph
            subdivision={subdivision}
            denominator={denominator}
            height={metronome.notationChip}
          />
          <Text style={styles.label}>{name}</Text>
          <Icon name="caretDown" size="caret" color="decor" />
        </View>
      </Pressable>
    </View>
  );
}
