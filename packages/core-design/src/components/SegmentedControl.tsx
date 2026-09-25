import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import { inset, radius, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { hitSlopForPadded } from '../touchTarget.ts';

export interface SegmentOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly accessibilityLabel?: string;
}

export interface SegmentedControlProps<T extends string> {
  readonly options: readonly SegmentOption<T>[];
  readonly selected: T | undefined;
  readonly onSelect: (value: T) => void;
  readonly accessibilityLabel: string;
  readonly compact?: boolean;
  readonly selectedTone?: 'neutral' | 'accent';
  readonly fill?: boolean;
  readonly neighbourGapDp?: number;
}

interface SegmentProps<T extends string> {
  readonly option: SegmentOption<T>;
  readonly selected: boolean;
  readonly accent: boolean;
  readonly hitSlop: number;
  readonly onSelect: (value: T) => void;
}

const useStyles = createThemedStyles((theme) => ({
  track: {
    flexDirection: 'row',
    borderRadius: radius.segment,
    backgroundColor: theme.color.surface2,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    padding: space.segmentInset,
    gap: space.segmentInset,
  },
  compact: {
    flexDirection: 'row',
    gap: space.segmentInset,
  },
  fill: {
    flex: 1,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: inset.segmentOptionV,
    paddingHorizontal: inset.segmentOptionH,
    borderRadius: radius.segmentOption,
  },
  optionSelected: {
    backgroundColor: theme.color.surface3,
  },
  label: {
    ...textStyle(textRoles.segment),
    color: theme.color.text2,
  },
  labelSelected: {
    color: theme.color.text,
  },
  labelAccent: {
    color: theme.color.accent,
  },
}));

function Segment<T extends string>({
  option,
  selected,
  accent,
  hitSlop,
  onSelect,
}: SegmentProps<T>) {
  const styles = useStyles();
  const handlePress = useCallback(() => {
    onSelect(option.value);
  }, [onSelect, option.value]);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={option.accessibilityLabel ?? option.label}
      accessibilityState={{ checked: selected }}
      style={[styles.option, selected && styles.optionSelected]}
      hitSlop={hitSlop}
      onPress={handlePress}
    >
      <Text
        style={[
          styles.label,
          selected && (accent ? styles.labelAccent : styles.labelSelected),
        ]}
      >
        {option.label}
      </Text>
    </Pressable>
  );
}

export function SegmentedControl<T extends string>({
  options,
  selected,
  onSelect,
  accessibilityLabel,
  compact = false,
  selectedTone = 'neutral',
  fill = false,
  neighbourGapDp = space.segmentInset,
}: SegmentedControlProps<T>) {
  const styles = useStyles();
  const hitSlop = hitSlopForPadded(
    textRoles.segment.size,
    inset.segmentOptionV,
    neighbourGapDp,
  );
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[compact ? styles.compact : styles.track, fill && styles.fill]}
    >
      {options.map((option) => (
        <Segment
          key={option.value}
          option={option}
          selected={option.value === selected}
          accent={selectedTone === 'accent'}
          hitSlop={hitSlop}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
}
