import { useCallback, useEffect, useRef } from 'react';
import {
  Pressable,
  View,
  type AccessibilityActionEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  scrollTo,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';

import { size, textRoles } from '../roles.ts';
import { wheelPicker } from '../metronomeRoles.ts';
import { UNSCALED_TEXT } from '../styleConstants.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { steppedIndex, wheelIndex } from '../wheel.ts';
import { useSheetContentLive } from './sheetContentLive.ts';

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
    position: 'absolute',
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
  readonly index: number;
  readonly liveIndex: SharedValue<number>;
  readonly onPress: (value: number) => void;
}

function WheelItem({ value, index, liveIndex, onPress }: WheelItemProps) {
  const styles = useStyles();
  const handlePress = useCallback(() => {
    onPress(value);
  }, [onPress, value]);
  const plain = useAnimatedStyle(() => ({
    opacity: liveIndex.value === index ? 0 : 1,
  }));
  const chosen = useAnimatedStyle(() => ({
    opacity: liveIndex.value === index ? 1 : 0,
  }));
  return (
    <Pressable style={styles.item} onPress={handlePress}>
      <Animated.Text
        maxFontSizeMultiplier={UNSCALED_TEXT}
        style={[styles.itemText, plain]}
      >
        {String(value)}
      </Animated.Text>
      <Animated.Text
        maxFontSizeMultiplier={UNSCALED_TEXT}
        style={[styles.selectedText, chosen]}
      >
        {String(value)}
      </Animated.Text>
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
  const scroll = useAnimatedRef<Animated.ScrollView>();
  const index = Math.max(values.indexOf(selected), 0);
  const initialOffset = useRef({ x: 0, y: index * PITCH }).current;
  const liveIndex = useSharedValue(index);
  const live = useSheetContentLive();
  const stale = useSharedValue(false);
  const moving = useSharedValue(false);
  const count = values.length;

  const resync = useCallback(
    (animated: boolean) => {
      'worklet';
      liveIndex.value = index;
      scrollTo(scroll, 0, index * PITCH, animated);
    },
    [liveIndex, index, scroll],
  );

  useEffect(() => {
    liveIndex.value = index;
    scroll.current?.scrollTo({ y: index * PITCH, animated: true });
  }, [index, liveIndex, scroll]);

  useAnimatedReaction(
    () => live.value,
    (now, previous) => {
      if (!now && previous === true) stale.value = true;
      if (!now || previous !== false) return;
      resync(false);
      if (!moving.value) stale.value = false;
    },
  );

  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      if (!live.value || stale.value) return;
      const next = wheelIndex(event.contentOffset.y, PITCH, count);
      if (liveIndex.value !== next) liveIndex.value = next;
    },
  });

  const settle = useCallback(
    (offsetY: number) => {
      const next = values[wheelIndex(offsetY, PITCH, values.length)];
      if (next !== undefined && next !== selected) onSelect(next);
    },
    [values, selected, onSelect],
  );

  const handleBeginDrag = useCallback(() => {
    stale.value = false;
  }, [stale]);

  const handleMomentumBegin = useCallback(() => {
    moving.value = true;
  }, [moving]);

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      moving.value = false;
      if (!stale.value) {
        settle(event.nativeEvent.contentOffset.y);
        return;
      }
      if (!live.value) return;
      stale.value = false;
      scheduleOnUI(resync, true);
    },
    [moving, stale, live, settle, resync],
  );

  const handleDragEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (stale.value) return;
      if ((event.nativeEvent.velocity?.y ?? 0) === 0) {
        settle(event.nativeEvent.contentOffset.y);
      }
    },
    [stale, settle],
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
        <Animated.ScrollView
          ref={scroll}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={PITCH}
          decelerationRate="fast"
          contentOffset={initialOffset}
          contentContainerStyle={styles.content}
          onScrollBeginDrag={handleBeginDrag}
          onMomentumScrollBegin={handleMomentumBegin}
          onMomentumScrollEnd={handleMomentumEnd}
          onScrollEndDrag={handleDragEnd}
          onScroll={handleScroll}
          scrollEventThrottle={1}
        >
          {values.map((value, valueIndex) => (
            <WheelItem
              key={value}
              value={value}
              index={valueIndex}
              liveIndex={liveIndex}
              onPress={onSelect}
            />
          ))}
        </Animated.ScrollView>
        <View style={styles.band} />
      </View>
    </View>
  );
}
