import type { ReactNode } from 'react';
import { useCallback } from 'react';
import {
  Pressable,
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

import { icons } from '../icons.ts';
import { iconSizes, inset, radius, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { minTouchTargetDp } from '../tokens.ts';
import { reorderTarget } from '../dragReorder.ts';
import { RowText } from './ListRow.tsx';

const HANDLE_HIT_SLOP = { top: inset.rowV, bottom: inset.rowV };
const DRAGGING_Z = 1;

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.rowGap,
    paddingVertical: inset.rowV,
    paddingHorizontal: inset.rowH,
    borderRadius: radius.row,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface1,
  },
  active: {
    borderColor: theme.color.accentDim,
    backgroundColor: theme.activeCardFill,
  },
  handle: {
    width: minTouchTargetDp,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleGlyph: { color: theme.color.text3, fontSize: iconSizes.control },
  index: {
    ...textStyle(textRoles.dragIndex),
    color: theme.color.text3,
    width: size.dragIndex,
  },
  press: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.rowGap,
  },
}));

export interface DragReorder {
  readonly index: number;
  readonly count: number;
  readonly onMove: (from: number, to: number) => void;
}

function useHandleDrag(reorder: DragReorder) {
  const offset = useSharedValue(0);
  const pitch = useSharedValue(0);
  const { index, count, onMove } = reorder;
  const pan = Gesture.Pan()
    .hitSlop(HANDLE_HIT_SLOP)
    .onUpdate((event) => {
      offset.value = event.translationY;
    })
    .onEnd((event) => {
      const to = reorderTarget(index, event.translationY, pitch.value, count);
      offset.value = 0;
      if (to !== index) scheduleOnRN(onMove, index, to);
    });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
    zIndex: offset.value === 0 ? 0 : DRAGGING_Z,
  }));
  const onLayout = (event: LayoutChangeEvent) => {
    pitch.value = event.nativeEvent.layout.height + space.controlGap;
  };
  return { pan, style, onLayout };
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
      <Text style={styles.handleGlyph}>{icons.dragHandle}</Text>
    </View>
  );
}

export interface DragListRowProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly trailing?: ReactNode;
  readonly active?: boolean;
  readonly reorder: DragReorder;
  readonly onPress: () => void;
  readonly onLongPress?: () => void;
  readonly accessibilityLabel: string;
}

function SongRowPress(props: Omit<DragListRowProps, 'reorder'>) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      accessibilityState={{ selected: props.active === true }}
      style={styles.press}
      onPress={props.onPress}
      onLongPress={props.onLongPress}
    >
      <RowText title={props.title} subtitle={props.subtitle} />
      {props.trailing}
    </Pressable>
  );
}

export function DragListRow(props: DragListRowProps) {
  const styles = useStyles();
  const drag = useHandleDrag(props.reorder);
  return (
    <Animated.View
      onLayout={drag.onLayout}
      style={[styles.row, props.active === true && styles.active, drag.style]}
    >
      <GestureDetector gesture={drag.pan}>
        <Handle reorder={props.reorder} />
      </GestureDetector>
      <Text style={styles.index}>{props.reorder.index + 1}</Text>
      <SongRowPress {...props} />
    </Animated.View>
  );
}

export type SongRowProps = Omit<DragListRowProps, 'reorder'>;

export function SongRow(props: SongRowProps) {
  const styles = useStyles();
  return (
    <View style={[styles.row, props.active === true && styles.active]}>
      <SongRowPress {...props} />
    </View>
  );
}
