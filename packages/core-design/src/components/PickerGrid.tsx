import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import { pickerRows } from '../pickerRows.ts';
import { inset, radius, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';

export interface PickerOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly accessibilityLabel?: string;
}

export interface PickerGridProps<T extends string> {
  readonly options: readonly PickerOption<T>[];
  readonly selected: T;
  readonly onSelect: (value: T) => void;
  readonly accessibilityLabel: string;
  readonly columns?: PickerColumns;
}

const PICKER_COLUMNS = { three: 3, four: 4 } as const;
type PickerColumns = (typeof PICKER_COLUMNS)[keyof typeof PICKER_COLUMNS];

interface PickerItemProps<T extends string> {
  readonly option: PickerOption<T>;
  readonly selected: boolean;
  readonly onSelect: (value: T) => void;
}

const useStyles = createThemedStyles((theme) => ({
  grid: {
    gap: space.controlGap,
  },
  row: {
    flexDirection: 'row',
    gap: space.controlGap,
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
  item: {
    minHeight: textRoles.segment.size + inset.buttonV * 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: inset.buttonV,
    paddingHorizontal: inset.segmentOptionH,
    borderRadius: radius.segmentOption,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface2,
  },
  selected: {
    borderColor: theme.color.accentDim,
    backgroundColor: theme.activeControlFill,
  },
  label: {
    ...textStyle(textRoles.segment),
    color: theme.color.text2,
    textAlign: 'center',
  },
  selectedLabel: {
    color: theme.color.accent,
  },
}));

function PickerItem<T extends string>({
  option,
  selected,
  onSelect,
}: PickerItemProps<T>) {
  const styles = useStyles();
  const handlePress = useCallback(() => {
    onSelect(option.value);
  }, [onSelect, option.value]);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={option.accessibilityLabel ?? option.label}
      accessibilityState={{ checked: selected }}
      style={[styles.cell, styles.item, selected && styles.selected]}
      onPress={handlePress}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]}>
        {option.label}
      </Text>
    </Pressable>
  );
}

export function PickerGrid<T extends string>({
  options,
  selected,
  onSelect,
  accessibilityLabel,
  columns = PICKER_COLUMNS.three,
}: PickerGridProps<T>) {
  const styles = useStyles();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={styles.grid}
    >
      {pickerRows(options, columns).map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((option, c) =>
            option === undefined ? (
              <View key={`empty-${String(c)}`} style={styles.cell} />
            ) : (
              <PickerItem
                key={option.value}
                option={option}
                selected={option.value === selected}
                onSelect={onSelect}
              />
            ),
          )}
        </View>
      ))}
    </View>
  );
}
