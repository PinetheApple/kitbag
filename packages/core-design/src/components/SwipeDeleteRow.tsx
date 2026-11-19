import { useCallback, type ReactNode } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  practiceHistory,
  practiceHistoryText,
} from '../practiceHistoryRoles.ts';
import {
  swipeActivation,
  swipeDeletes,
  swipeOffset,
  type SwipeSide,
} from '../swipeDelete.ts';
import { TRANSPARENT } from '../styleConstants.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles, useTheme } from '../ThemeProvider.tsx';
import { Icon } from './Icon.tsx';

const VERTICAL_FAIL: [number, number] = [
  -practiceHistory.swipeStartDp,
  practiceHistory.swipeStartDp,
];

const useStyles = createThemedStyles((theme) => ({
  wrap: { position: 'relative', overflow: 'hidden' },
  under: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.red,
  },
  underLeft: { justifyContent: 'flex-end' },
  underRight: { justifyContent: 'flex-start' },
  panel: {
    width: practiceHistory.swipePanel,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: practiceHistory.swipePanelGap,
  },
  label: {
    ...textStyle(practiceHistoryText.swipeLabel),
    color: theme.color.bg,
  },
}));

export interface SwipeDeleteRowProps {
  readonly side: SwipeSide;
  readonly deleteLabel: string;
  readonly onDelete: () => void;
  readonly children: ReactNode;
}

export function SwipeDeleteRow({
  side,
  deleteLabel,
  onDelete,
  children,
}: SwipeDeleteRowProps) {
  const styles = useStyles();
  const theme = useTheme();
  const offset = useSharedValue(0);
  const width = useSharedValue(0);
  const moving = theme.color.surface1;
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      width.value = event.nativeEvent.layout.width;
    },
    [width],
  );
  const pan = Gesture.Pan()
    .activeOffsetX(swipeActivation(side, practiceHistory.swipeStartDp))
    .failOffsetY(VERTICAL_FAIL)
    .onUpdate((event) => {
      offset.value = swipeOffset(event.translationX, side);
    })
    .onEnd((event) => {
      if (!swipeDeletes(event.translationX, width.value, side)) {
        offset.value = withTiming(0);
        return;
      }
      const gone = side === 'left' ? -width.value : width.value;
      offset.value = withTiming(gone, undefined, (finished) => {
        if (finished === true) scheduleOnRN(onDelete);
      });
    });
  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
    backgroundColor: offset.value === 0 ? TRANSPARENT : moving,
  }));
  const underStyle = useAnimatedStyle(() => ({
    opacity: offset.value === 0 ? 0 : 1,
  }));
  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <Animated.View
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={[
          styles.under,
          side === 'left' ? styles.underLeft : styles.underRight,
          underStyle,
        ]}
      >
        <View style={styles.panel}>
          <Icon name="delete" size="action" color="bg" />
          <Text style={styles.label}>{deleteLabel}</Text>
        </View>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}
