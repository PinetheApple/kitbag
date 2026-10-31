import { useCallback } from 'react';
import {
  Text,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { inset, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { minTouchTargetDp } from '../tokens.ts';
import { dropTarget } from '../dragReorder.ts';
import { Icon } from './Icon.tsx';
import {
  RowPress,
  usePlainRowStyles,
  type PlainListRowProps,
} from './PlainListRow.tsx';

const HANDLE_HIT_SLOP = { top: inset.rowV, bottom: inset.rowV };
const DRAGGING_Z = 1;

const useStyles = createThemedStyles((theme) => ({
  handle: {
    width: minTouchTargetDp,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  index: {
    ...textStyle(textRoles.dragIndex),
    color: theme.color.text3,
    width: size.dragIndex,
  },
}));

export interface DragReorder {
  readonly index: number;
  readonly count: number;
  readonly onMove: (from: number, to: number) => void;
  readonly onDragActive?: (active: boolean) => void;
}

export function useHandleDrag(reorder: DragReorder) {
  const offset = useSharedValue(0);
  const pitch = useSharedValue(0);
  const { index, count, onMove, onDragActive } = reorder;
  const pan = Gesture.Pan()
    .hitSlop(HANDLE_HIT_SLOP)
    .onBegin(() => {
      if (onDragActive !== undefined) scheduleOnRN(onDragActive, true);
    })
    .onUpdate((event) => {
      offset.value = event.translationY;
    })
    .onEnd((event, success) => {
      const to = dropTarget(
        index,
        event.translationY,
        pitch.value,
        count,
        success,
      );
      if (to !== null) scheduleOnRN(onMove, index, to);
    })
    .onFinalize(() => {
      offset.value = 0;
      if (onDragActive !== undefined) scheduleOnRN(onDragActive, false);
    });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
    zIndex: offset.value === 0 ? 0 : DRAGGING_Z,
  }));
  const onLayout = (event: LayoutChangeEvent) => {
    pitch.value = event.nativeEvent.layout.height + space.controlGap;
  };
  return { pan, style, onLayout, offset };
}

function useHandleActions(reorder: DragReorder) {
  const { index, count, onMove } = reorder;
  return useCallback(
    (event: AccessibilityActionEvent) => {
      const name = event.nativeEvent.actionName;
      if (name === 'decrement' && index > 0) onMove(index, index - 1);
      if (name === 'increment' && index + 1 < count) onMove(index, index + 1);
    },
    [index, count, onMove],
  );
}

function Handle({ reorder }: { readonly reorder: DragReorder }) {
  const styles = useStyles();
  const onAction = useHandleActions(reorder);
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`Reorder, position ${String(reorder.index + 1)} of ${String(reorder.count)}`}
      accessibilityActions={[
        { name: 'increment', label: 'Move later' },
        { name: 'decrement', label: 'Move earlier' },
      ]}
      onAccessibilityAction={onAction}
      style={styles.handle}
    >
      <Icon name="dragHandle" size="control" color="text3" />
    </View>
  );
}

export interface DragListRowProps extends PlainListRowProps {
  readonly reorder: DragReorder;
}

export function DragListRow(props: DragListRowProps) {
  const styles = useStyles();
  const row = usePlainRowStyles();
  const drag = useHandleDrag(props.reorder);
  return (
    <Animated.View
      onLayout={drag.onLayout}
      style={[row.row, props.active === true && row.active, drag.style]}
    >
      <GestureDetector gesture={drag.pan}>
        <Handle reorder={props.reorder} />
      </GestureDetector>
      <Text style={styles.index}>{props.reorder.index + 1}</Text>
      <RowPress {...props} />
    </Animated.View>
  );
}
