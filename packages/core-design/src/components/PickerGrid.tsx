import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import { inset, radius, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { minTouchTargetDp } from '../tokens.ts';
import type { SegmentOption } from './SegmentedControl.tsx';

const useStyles = createThemedStyles((theme) => ({
  grid: { gap: space.controlGap },
  row: { flexDirection: 'row', gap: space.controlGap },
  filler: { flex: 1 },
  option: {
    flex: 1,
    minHeight: minTouchTargetDp,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: inset.pickV,
    paddingHorizontal: inset.pickH,
    borderRadius: radius.pick,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface2,
  },
  selected: {
    borderColor: theme.color.accentDim,
    backgroundColor: theme.activeControlFill,
  },
  label: { ...textStyle(textRoles.chip), color: theme.color.text2 },
  labelSelected: { color: theme.color.accent },
}));

interface PickProps<T extends string> {
  readonly option: SegmentOption<T>;
  readonly selected: boolean;
  readonly onSelect: (value: T) => void;
}

function Pick<T extends string>({ option, selected, onSelect }: PickProps<T>) {
  const styles = useStyles();
  const handlePress = useCallback(() => {
    onSelect(option.value);
  }, [onSelect, option.value]);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={option.accessibilityLabel ?? option.label}
      accessibilityState={{ checked: selected }}
      style={[styles.option, selected && styles.selected]}
      onPress={handlePress}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>
        {option.label}
      </Text>
    </Pressable>
  );
}

function rowsOf<T>(items: readonly T[], columns: number): T[][] {
  const rows: T[][] = [];
  for (let start = 0; start < items.length; start += columns) {
    rows.push(items.slice(start, start + columns));
  }
  return rows;
}

export interface PickerGridProps<T extends string> {
  readonly options: readonly SegmentOption<T>[];
  readonly selected: T | undefined;
  readonly onSelect: (value: T) => void;
  readonly accessibilityLabel: string;
  readonly columns?: number;
}

export function PickerGrid<T extends string>(props: PickerGridProps<T>) {
  const styles = useStyles();
  const columns = props.columns ?? props.options.length;
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={props.accessibilityLabel}
      style={styles.grid}
    >
      {rowsOf(props.options, columns).map((row) => (
        <View key={row[0]?.value} style={styles.row}>
          {row.map((option) => (
            <Pick
              key={option.value}
              option={option}
              selected={option.value === props.selected}
              onSelect={props.onSelect}
            />
          ))}
          {Array.from({ length: columns - row.length }, (_u, i) => (
            <View key={i} style={styles.filler} />
          ))}
        </View>
      ))}
    </View>
  );
}
