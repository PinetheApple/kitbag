import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import { inset, radius, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import {
  hitBoxStyle,
  hitExtension,
  neighbourGaps,
  unshared,
  type NeighbourGaps,
} from '../touchTarget.ts';

// In a track, an option's edge sits inside the inset and border, a strip that
// is the option's alone.
const TRACK_EDGE = space.segmentInset + size.stroke;
const OPTION_HEIGHT = textRoles.segment.size + inset.segmentOptionV * 2;

// Option widths are flex, so only the vertical axis is grown to 48dp; sideways
// every option takes the same half of the gap between options, which keeps
// their visible widths equal.
function optionHitBox(gaps: NeighbourGaps, compact: boolean) {
  const edge = compact ? 0 : TRACK_EDGE;
  const vertical = hitExtension(OPTION_HEIGHT, OPTION_HEIGHT, {
    top: unshared(edge) + (gaps.top ?? Number.POSITIVE_INFINITY),
    bottom: unshared(edge) + (gaps.bottom ?? Number.POSITIVE_INFINITY),
  });
  const side = space.segmentInset / 2;
  return hitBoxStyle({
    top: vertical.top,
    bottom: vertical.bottom,
    left: side,
    right: side,
  });
}

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
  /** Gaps to the controls around the track; a number applies to every side,
   * an omitted side has no neighbour. */
  readonly neighbourGapDp?: number | NeighbourGaps;
}

interface SegmentProps<T extends string> {
  readonly option: SegmentOption<T>;
  readonly selected: boolean;
  readonly accent: boolean;
  readonly hitBox: ReturnType<typeof optionHitBox>;
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
  optionHit: {
    flex: 1,
  },
  option: {
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
  hitBox,
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
      style={[styles.optionHit, hitBox]}
      onPress={handlePress}
    >
      <View style={[styles.option, selected && styles.optionSelected]}>
        <Text
          style={[
            styles.label,
            selected && (accent ? styles.labelAccent : styles.labelSelected),
          ]}
        >
          {option.label}
        </Text>
      </View>
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
  const hitBox = optionHitBox(neighbourGaps(neighbourGapDp), compact);
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
          hitBox={hitBox}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
}
