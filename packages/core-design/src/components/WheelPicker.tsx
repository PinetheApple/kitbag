import { useCallback, useEffect, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type AccessibilityActionEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { size, textRoles } from '../roles.ts';
import { wheelPicker } from '../metronomeRoles.ts';
import { UNSCALED_TEXT } from '../styleConstants.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { steppedIndex, wheelIndex } from '../wheel.ts';

const ITEMS_EACH_SIDE = 2;
const PITCH = (wheelPicker.item + wheelPicker.selected) / 2;
const WINDOW = wheelPicker.selected + ITEMS_EACH_SIDE * 2 * wheelPicker.item;
const EDGE_ROOM = (WINDOW - PITCH) / 2;
const BAND_TOP = (WINDOW - wheelPicker.selected) / 2;
const STEP = 1;

const A11Y_ACTIONS = [{ name: 'increment' }, { name: 'decrement' }] as const;

const useStyles = createThemedStyles((theme) => ({
  wheel: {
    width: wheelPicker.width,
    paddingVertical: wheelPicker.insetV,
    borderRadius: wheelPicker.radius,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface2,
  },
  window: {
    height: WINDOW,
    overflow: 'hidden',
  },
  content: {
    paddingVertical: EDGE_ROOM,
  },
  item: {
    height: PITCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    ...textStyle(textRoles.wheelItem),
    color: theme.color.text3,
  },
  selectedText: {
    ...textStyle(textRoles.wheelSelected),
    color: theme.color.text,
  },
  band: {
    position: 'absolute',
    top: BAND_TOP,
    left: 0,
    right: 0,
    height: wheelPicker.selected,
    borderTopWidth: size.stroke,
    borderBottomWidth: size.stroke,
    borderColor: theme.color.line,
    pointerEvents: 'none',
  },
}));

interface WheelItemProps {
  readonly value: number;
  readonly selected: boolean;
  readonly onPress: (value: number) => void;
}

function WheelItem({ value, selected, onPress }: WheelItemProps) {
  const styles = useStyles();
  const handlePress = useCallback(() => {
    onPress(value);
  }, [onPress, value]);
  return (
    <Pressable style={styles.item} onPress={handlePress}>
      <Text
        maxFontSizeMultiplier={UNSCALED_TEXT}
        style={selected ? styles.selectedText : styles.itemText}
      >
        {String(value)}
      </Text>
    </Pressable>
  );
}

export interface WheelPickerProps {
  readonly values: readonly number[];
  readonly selected: number;
  readonly onSelect: (value: number) => void;
  readonly accessibilityLabel: string;
}

export function WheelPicker({
  values,
  selected,
  onSelect,
  accessibilityLabel,
}: WheelPickerProps) {
  const styles = useStyles();
  const scroll = useRef<ScrollView>(null);
  const index = Math.max(values.indexOf(selected), 0);
  const initialOffset = useRef({ x: 0, y: index * PITCH }).current;

  useEffect(() => {
    scroll.current?.scrollTo({ y: index * PITCH, animated: true });
  }, [index]);

  const settle = useCallback(
    (offsetY: number) => {
      const next = values[wheelIndex(offsetY, PITCH, values.length)];
      if (next !== undefined && next !== selected) onSelect(next);
    },
    [values, selected, onSelect],
  );

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      settle(event.nativeEvent.contentOffset.y);
    },
    [settle],
  );

  const handleDragEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if ((event.nativeEvent.velocity?.y ?? 0) === 0) {
        settle(event.nativeEvent.contentOffset.y);
      }
    },
    [settle],
  );

  const handleAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const delta = event.nativeEvent.actionName === 'increment' ? STEP : -STEP;
      const next = values[steppedIndex(index, delta, values.length)];
      if (next !== undefined) onSelect(next);
    },
    [values, index, onSelect],
  );

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: String(selected) }}
      accessibilityActions={A11Y_ACTIONS}
      onAccessibilityAction={handleAccessibilityAction}
      style={styles.wheel}
    >
      <View style={styles.window}>
        <ScrollView
          ref={scroll}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={PITCH}
          decelerationRate="fast"
          contentOffset={initialOffset}
          contentContainerStyle={styles.content}
          onMomentumScrollEnd={handleMomentumEnd}
          onScrollEndDrag={handleDragEnd}
        >
          {values.map((value) => (
            <WheelItem
              key={value}
              value={value}
              selected={value === selected}
              onPress={onSelect}
            />
          ))}
        </ScrollView>
        <View style={styles.band} />
      </View>
    </View>
  );
}
