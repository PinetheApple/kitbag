import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';

import { homeArrange, homeArrangeText } from '../homeArrangeRoles.ts';
import {
  bodyLineHeight,
  inset,
  radius,
  size,
  space,
  textRoles,
} from '../roles.ts';
import {
  INLINE_LINE_HEIGHT,
  segmentHitBox,
  wrappedRowGap,
  type SegmentedControlSize,
} from '../segmentHitBox.ts';
import { equalOptionMinWidth, type OptionMinWidth } from '../segmentWidth.ts';
import { growNeverShrink, growShrinkToLine } from '../textScale.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { neighbourGaps, type NeighbourGaps } from '../touchTarget.ts';
import { useTextScaled } from '../useTextScaled.ts';

export type { SegmentedControlSize } from '../segmentHitBox.ts';

type LineTopReport<T extends string> = (
  value: T,
  lineTop: number | undefined,
) => void;

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
  readonly size?: SegmentedControlSize;
}

interface SegmentProps<T extends string> {
  readonly option: SegmentOption<T>;
  readonly selected: boolean;
  readonly accent: boolean;
  readonly large: boolean;
  readonly tab: boolean;
  readonly inline: boolean;
  readonly editRow: boolean;
  readonly minWidthStyle: OptionMinWidth | undefined;
  readonly onLabelWidth: (value: T, width: number) => void;
  readonly row: boolean;
  readonly byLabel: boolean;
  readonly hitBox: ReturnType<typeof segmentHitBox>;
  readonly onLineTop: LineTopReport<T> | undefined;
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
  byLabel: growNeverShrink,
  fillByLabel: growShrinkToLine,
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
    color: theme.color[theme.accentInk],
  },
  largeTrack: {
    borderRadius: radius.segmentLarge,
  },
  largeOption: {
    minHeight: size.segmentLargeOption,
    paddingVertical: 0,
    justifyContent: 'center',
    borderRadius: radius.segmentLargeOption,
  },
  largeOptionSelected: {
    backgroundColor: theme.color.surface1,
  },
  largeLabel: textStyle(textRoles.segmentLarge),
  tabOption: { minHeight: size.segmentTabOption },
  tabLabel: textStyle(textRoles.segmentTab),
  editRowOption: {
    minHeight: size.segmentEditRowOption,
    paddingHorizontal: inset.segmentEditRowOptionH,
  },
  inlineLabel: { lineHeight: INLINE_LINE_HEIGHT },
  rowTrack: {
    padding: homeArrange.segmentInset,
  },
  rowOption: {
    paddingVertical: homeArrange.segmentOptionV,
    paddingHorizontal: homeArrange.segmentOptionH,
  },
  rowLabel: {
    ...textStyle(homeArrangeText.segment),
    lineHeight: homeArrangeText.segment.size * bodyLineHeight,
  },
}));

function Segment<T extends string>({
  option,
  selected,
  accent,
  large,
  tab,
  inline,
  editRow,
  minWidthStyle,
  onLabelWidth,
  row,
  byLabel,
  hitBox,
  onLineTop,
  onSelect,
}: SegmentProps<T>) {
  const styles = useStyles();
  const handlePress = useCallback(() => {
    onSelect(option.value);
  }, [onSelect, option.value]);
  const handleLabelLayout = useCallback(
    (event: LayoutChangeEvent) => {
      onLabelWidth(option.value, event.nativeEvent.layout.width);
    },
    [onLabelWidth, option.value],
  );
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      onLineTop?.(
        option.value,
        Math.round(event.nativeEvent.layout.y + hitBox.paddingTop),
      );
    },
    [onLineTop, option.value, hitBox.paddingTop],
  );
  useEffect(
    () => () => {
      onLineTop?.(option.value, undefined);
    },
    [onLineTop, option.value],
  );

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={option.accessibilityLabel ?? option.label}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      style={[
        !inline &&
          !editRow &&
          !row &&
          (byLabel ? styles.byLabel : styles.optionHit),
        hitBox,
      ]}
      onLayout={onLineTop === undefined ? undefined : handleLayout}
      onPress={handlePress}
    >
      <View
        style={[
          styles.option,
          large && styles.largeOption,
          tab && styles.tabOption,
          editRow && styles.editRowOption,
          minWidthStyle,
          row && styles.rowOption,
          selected && styles.optionSelected,
          selected && large && styles.largeOptionSelected,
        ]}
      >
        <Text
          style={[
            styles.label,
            large && styles.largeLabel,
            tab && styles.tabLabel,
            inline && styles.inlineLabel,
            row && styles.rowLabel,
            selected && (accent ? styles.labelAccent : styles.labelSelected),
          ]}
          onLayout={editRow ? handleLabelLayout : undefined}
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
  size: controlSize = 'default',
}: SegmentedControlProps<T>) {
  const styles = useStyles();
  const byLabel = useTextScaled();
  const editRow = controlSize === 'editRow';
  const tab = controlSize === 'tab';
  const large = controlSize === 'large' || editRow || tab;
  const [labelWidths, setLabelWidths] = useState<Partial<Record<T, number>>>(
    {},
  );
  const handleLabelWidth = useCallback((value: T, width: number) => {
    setLabelWidths((prev) =>
      prev[value] === width ? prev : { ...prev, [value]: width },
    );
  }, []);
  const measured = options.flatMap((option) => {
    const width = labelWidths[option.value];
    return width === undefined ? [] : [width];
  });
  const minWidthStyle =
    editRow && options.length > 0 && measured.length === options.length
      ? equalOptionMinWidth(measured, inset.segmentEditRowOptionH)
      : undefined;
  const row = controlSize === 'row';
  const [lineTops, setLineTops] = useState<Partial<Record<T, number>>>({});
  const handleLineTop = useCallback((value: T, lineTop: number | undefined) => {
    setLineTops((prev) =>
      prev[value] === lineTop ? prev : { ...prev, [value]: lineTop },
    );
  }, []);
  const tops = options.flatMap((option) => {
    const top = lineTops[option.value];
    return top === undefined ? [] : [top];
  });
  const outer = neighbourGaps(neighbourGapDp);
  const hitBoxFor = (value: T) =>
    segmentHitBox({
      controlSize,
      compact,
      outer,
      wrapped: byLabel
        ? { lineTop: lineTops[value], lineTops: tops }
        : undefined,
    });
  const wraps = useMemo(
    () => ({ flexWrap: 'wrap' as const, rowGap: wrappedRowGap(controlSize) }),
    [controlSize],
  );
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[
        compact ? styles.compact : styles.track,
        large && !compact && styles.largeTrack,
        row && !compact && styles.rowTrack,
        fill && (byLabel ? styles.fillByLabel : styles.fill),
        byLabel && wraps,
      ]}
    >
      {options.map((option) => (
        <Segment
          key={option.value}
          option={option}
          selected={option.value === selected}
          accent={selectedTone === 'accent'}
          large={large}
          tab={tab}
          inline={controlSize === 'inline'}
          editRow={editRow}
          minWidthStyle={minWidthStyle}
          onLabelWidth={handleLabelWidth}
          row={row}
          byLabel={byLabel}
          hitBox={hitBoxFor(option.value)}
          onLineTop={byLabel ? handleLineTop : undefined}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
}
