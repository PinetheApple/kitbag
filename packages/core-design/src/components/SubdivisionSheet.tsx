import { useCallback, useMemo } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { metronomeSheet } from '../metronomeRoles.ts';
import { radius, size, space, textRoles } from '../roles.ts';
import {
  inRows,
  spokenSubdivision,
  subdivisionChoices,
  subdivisionColumns,
  subdivisionName,
} from '../subdivisionText.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { NotationGlyph } from './NotationGlyph.tsx';
import { usePickedTileStyles } from './pickedTileStyles.ts';
import { Sheet } from './Sheet.tsx';
import { SheetHint } from './SheetHint.tsx';

export interface SubdivisionBounds {
  readonly min: number;
  readonly max: number;
}

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
  const pickedStyles = usePickedTileStyles();
  const handlePress = useCallback(() => {
    onPick(subdivision);
  }, [onPick, subdivision]);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={spokenSubdivision(subdivision, denominator)}
      accessibilityState={{ checked: selected }}
      style={[styles.tile, selected && pickedStyles.selectedTile]}
      onPress={handlePress}
    >
      <NotationGlyph
        subdivision={subdivision}
        denominator={denominator}
        height={metronomeSheet.notationTileGlyph}
        color={selected ? 'text' : 'text2'}
      />
      <Text style={[styles.label, selected && styles.selectedLabel]}>
        {subdivisionName(subdivision, denominator)}
      </Text>
    </Pressable>
  );
}

export interface SubdivisionSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly subdivision: number;
  readonly denominator: number;
  readonly bounds: SubdivisionBounds;
  readonly onPick: (subdivision: number) => void;
  readonly onDismiss: () => void;
}

export function SubdivisionSheet({
  visible,
  bottomInset,
  subdivision,
  denominator,
  bounds,
  onPick,
  onDismiss,
}: SubdivisionSheetProps) {
  const styles = useStyles();
  const { fontScale } = useWindowDimensions();
  const choices = useMemo(() => subdivisionChoices(bounds), [bounds]);
  const handlePick = useCallback(
    (next: number) => {
      onPick(next);
      onDismiss();
    },
    [onPick, onDismiss],
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
        {inRows(choices, subdivisionColumns(fontScale)).map((row) => (
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
        {`Per written beat, ${String(bounds.min)}–${String(bounds.max)}. One tap sets it and closes the sheet; applies live.`}
      </SheetHint>
    </Sheet>
  );
}
