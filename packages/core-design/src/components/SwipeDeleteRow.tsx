import { useCallback, useMemo, type ReactNode } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  swipeActivation,
  swipeDeletes,
  swipeOffset,
  type SwipeSide,
} from '../swipeDelete.ts';
import { swipeDelete, swipeDeleteText } from '../swipeDeleteRoles.ts';
import { TRANSPARENT } from '../styleConstants.ts';
import { mixHex, type Theme } from '../theme.ts';
import type { ColorToken } from '../tokens.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles, useTheme } from '../ThemeProvider.tsx';
import { Icon } from './Icon.tsx';

export type SwipeDeleteTone = 'solid' | 'tint';

const tintInk = (theme: Theme): ColorToken =>
  theme.mode === 'light' ? 'redInk' : 'red';

const VERTICAL_FAIL: [number, number] = [
  -swipeDelete.swipeStartDp,
  swipeDelete.swipeStartDp,
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
    width: swipeDelete.panel,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: swipeDelete.panelGap,
  },
  label: {
    ...textStyle(swipeDeleteText.label),
    color: theme.color.bg,
  },
  underTint: {
    backgroundColor: mixHex(
      theme.color.red,
      theme.color.surface1,
      swipeDelete.tintMix,
    ),
  },
  labelTint: {
    ...textStyle(swipeDeleteText.tintLabel),
    color: theme.color[tintInk(theme)],
  },
}));

export interface SwipeDeleteRowProps {
  readonly side: SwipeSide;
  readonly deleteLabel: string;
  readonly onDelete: () => Promise<boolean>;
  readonly tone?: SwipeDeleteTone;
  readonly radius?: number;
  readonly children: ReactNode;
}

export function SwipeDeleteRow({
  side,
  deleteLabel,
  onDelete,
  tone = 'solid',
  radius = 0,
  children,
}: SwipeDeleteRowProps) {
  const styles = useStyles();
  const theme = useTheme();
  const offset = useSharedValue(0);
  const width = useSharedValue(0);
  const moving = theme.color.surface1;
  const rounded = useMemo(() => ({ borderRadius: radius }), [radius]);
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      width.value = event.nativeEvent.layout.width;
    },
    [width],
  );
  const runDelete = useCallback(() => {
    void onDelete().then((deleted) => {
      if (!deleted) offset.value = withTiming(0);
    });
  }, [onDelete, offset]);
  const pan = Gesture.Pan()
    .activeOffsetX(swipeActivation(side, swipeDelete.swipeStartDp))
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
        if (finished === true) scheduleOnRN(runDelete);
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
    <View style={[styles.wrap, rounded]} onLayout={onLayout}>
      <Animated.View
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={[
          styles.under,
          side === 'left' ? styles.underLeft : styles.underRight,
          tone === 'tint' && styles.underTint,
          underStyle,
        ]}
      >
        <View style={styles.panel}>
          <Icon
            name="delete"
            size={tone === 'tint' ? 'swipeRemove' : 'action'}
            color={tone === 'tint' ? tintInk(theme) : 'bg'}
          />
          <Text style={[styles.label, tone === 'tint' && styles.labelTint]}>
            {deleteLabel}
          </Text>
        </View>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}
