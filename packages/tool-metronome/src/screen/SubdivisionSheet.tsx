import {
  createThemedStyles,
  metronomeSheet,
  NotationGlyph,
  radius,
  Sheet,
  SheetHint,
  size,
  space,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import { KB_SUBDIVISION_BOUNDS } from '@kitbag/core-native';
import { useMetronome } from '@kitbag/core-state';
import { useCallback } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import {
  inRows,
  spokenSubdivision,
  subdivisionChoices,
  subdivisionColumns,
  subdivisionName,
} from '../logic/subdivision.ts';
import { useSheetStyles } from './sheetStyles.ts';

const CHOICES = subdivisionChoices(KB_SUBDIVISION_BOUNDS);

const useStyles = createThemedStyles((theme) => ({
  grid: {
    gap: space.controlGap,
  },
  row: {
    flexDirection: 'row',
    gap: space.controlGap,
  },
  tile: {
    flex: 1,
    minHeight: metronomeSheet.notationTile,
    alignItems: 'center',
    justifyContent: 'center',
    gap: metronomeSheet.notationTileGap,
    borderRadius: radius.button,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface2,
  },
  label: {
    ...textStyle(textRoles.notationTile),
    color: theme.color.text2,
    textAlign: 'center',
  },
  selectedLabel: {
    color: theme.color.text,
  },
}));

interface TileProps {
  readonly subdivision: number;
  readonly denominator: number;
  readonly selected: boolean;
  readonly onPick: (subdivision: number) => void;
}

function NotationTile({
  subdivision,
  denominator,
  selected,
  onPick,
}: TileProps) {
  const styles = useStyles();
  const sheetStyles = useSheetStyles();
  const handlePress = useCallback(() => {
    onPick(subdivision);
  }, [onPick, subdivision]);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={spokenSubdivision(subdivision, denominator)}
      accessibilityState={{ checked: selected }}
      style={[styles.tile, selected && sheetStyles.selectedTile]}
      onPress={handlePress}
    >
      <NotationGlyph
        subdivision={subdivision}
        height={metronomeSheet.notationTileGlyph}
        color={selected ? 'text' : 'text2'}
      />
      <Text style={[styles.label, selected && styles.selectedLabel]}>
        {subdivisionName(subdivision, denominator)}
      </Text>
    </Pressable>
  );
}

interface SubdivisionSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

export function SubdivisionSheet({
  visible,
  bottomInset,
  onDismiss,
}: SubdivisionSheetProps) {
  const styles = useStyles();
  const { fontScale } = useWindowDimensions();
  const subdivision = useMetronome((s) => s.subdivision);
  const denominator = useMetronome((s) => s.denominator);
  const setSubdivision = useMetronome((s) => s.setSubdivision);
  const handlePick = useCallback(
    (next: number) => {
      setSubdivision(next);
      onDismiss();
    },
    [setSubdivision, onDismiss],
  );
  return (
    <Sheet
      visible={visible}
      title="Subdivision"
      dismissLabel="Close subdivision"
      bottomInset={bottomInset}
      dim
      onDismiss={onDismiss}
    >
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Subdivision"
        style={styles.grid}
      >
        {inRows(CHOICES, subdivisionColumns(fontScale)).map((row) => (
          <View key={row[0]} style={styles.row}>
            {row.map((choice) => (
              <NotationTile
                key={choice}
                subdivision={choice}
                denominator={denominator}
                selected={choice === subdivision}
                onPick={handlePick}
              />
            ))}
          </View>
        ))}
      </View>
      <SheetHint centered size="large">
        {`Per written beat, ${String(KB_SUBDIVISION_BOUNDS.min)}–${String(KB_SUBDIVISION_BOUNDS.max)}. One tap sets it and closes the sheet; applies live.`}
      </SheetHint>
    </Sheet>
  );
}
