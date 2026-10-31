import {
  bodyLineHeight,
  createThemedStyles,
  hitBoxStyle,
  hitExtension,
  homeArrange,
  homeArrangeText,
  InlineIcon,
  SegmentedControl,
  size,
  textStyle,
  unshared,
  useHandleDrag,
  useTheme,
  type SegmentOption,
  type ToolTileSize,
} from '@kitbag/core-design';
import { hideTile, moveTile, resizeTile } from '@kitbag/core-state';
import { useCallback, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import {
  ARRANGE_ACTION,
  applyArrangeAction,
  arrangeActions,
  type ArrangeActionName,
  type HomeArrangement,
  type HomeTile,
} from './arrangement.ts';
import type { HomeToolEntry } from './registry.ts';

const RESTING_Z = 0;
const LIFTED_Z = 1;
const RESTING_SCALE = 1;
const ROW_EDGE =
  unshared(homeArrange.rowPadV + size.stroke) + homeArrange.rowGap;
const EYE_HIT_BOX = hitBoxStyle(
  hitExtension(homeArrange.eyeBox, homeArrange.eyeBox, {
    top: ROW_EDGE,
    bottom: ROW_EDGE,
    left: homeArrange.rowInnerGap,
    right: unshared(homeArrange.rowPadEnd + size.stroke),
  }),
);

const ACTION_NAMES: readonly string[] = Object.values(ARRANGE_ACTION);

function isArrangeAction(name: string): name is ArrangeActionName {
  return ACTION_NAMES.includes(name);
}

const SIZE_LABEL: Readonly<Record<ToolTileSize, string>> = {
  '1x1': '1×1',
  '2x1': '2×1',
};

const SIZE_OPTIONS: readonly SegmentOption<ToolTileSize>[] = [
  { value: '1x1', label: SIZE_LABEL['1x1'], accessibilityLabel: 'Half width' },
  { value: '2x1', label: SIZE_LABEL['2x1'], accessibilityLabel: 'Full width' },
];

export const useArrangeRowStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: homeArrange.rowInnerGap,
    minHeight: homeArrange.rowMinHeight,
    paddingTop: homeArrange.rowPadV,
    paddingBottom: homeArrange.rowPadV,
    paddingRight: homeArrange.rowPadEnd,
    borderRadius: homeArrange.rowRadius,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface2,
  },
  hiddenRow: {
    opacity: homeArrange.hiddenRowOpacity,
  },
  handle: {
    width: homeArrange.handleWidth,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleGlyph: {
    fontSize: homeArrange.handleIcon,
    color: theme.color.text2,
  },
  handleGlyphLifted: {
    fontSize: homeArrange.handleIcon,
    color: theme.color.accent,
  },
  label: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: homeArrange.rowInnerGap,
  },
  icon: {
    fontSize: homeArrange.rowIcon,
    color: theme.color.text,
  },
  name: {
    ...textStyle(homeArrangeText.name),
    lineHeight: homeArrangeText.name.size * bodyLineHeight,
    flex: 1,
    color: theme.color.text,
  },
  eye: {
    width: homeArrange.eyeBox,
    height: homeArrange.eyeBox,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeGlyph: {
    fontSize: homeArrange.eyeIcon,
    color: theme.color.text2,
  },
  drop: {
    borderRadius: homeArrange.rowRadius,
    borderWidth: homeArrange.dropBorder,
    borderStyle: 'dashed',
    borderColor: theme.color.accentDim,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

interface ArrangeRowProps {
  readonly tile: HomeTile;
  readonly tool: HomeToolEntry;
  readonly index: number;
  readonly count: number;
  readonly arrangement: HomeArrangement;
  readonly onArrange: (next: HomeArrangement) => void;
}

export function useArrangeActions(
  arrangement: HomeArrangement,
  tile: HomeTile,
  onArrange: (next: HomeArrangement) => void,
) {
  const actions = useMemo(
    () => arrangeActions(arrangement, tile),
    [arrangement, tile],
  );
  const onAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const name = event.nativeEvent.actionName;
      if (!isArrangeAction(name)) return;
      onArrange(applyArrangeAction(arrangement, tile.toolId, name));
    },
    [arrangement, tile.toolId, onArrange],
  );
  return { actions, onAction };
}

function useLift(offset: ReturnType<typeof useHandleDrag>['offset']) {
  const theme = useTheme();
  const { line, surface2, surface3, accent } = theme.color;
  const shadow = theme.shadow;
  const slot = useAnimatedStyle(() => ({
    zIndex: offset.value === 0 ? RESTING_Z : LIFTED_Z,
  }));
  const drop = useAnimatedStyle(() => ({
    opacity: offset.value === 0 ? 0 : 1,
  }));
  const row = useAnimatedStyle(() => {
    const lifted = offset.value !== 0;
    return {
      transform: [
        { translateY: offset.value },
        { scale: lifted ? homeArrange.liftScale : RESTING_SCALE },
      ],
      borderColor: lifted ? accent : line,
      backgroundColor: lifted ? surface3 : surface2,
      boxShadow: lifted ? shadow : 'none',
    };
  });
  return { slot, drop, row };
}

export function ArrangeRow({
  tile,
  tool,
  index,
  count,
  arrangement,
  onArrange,
}: ArrangeRowProps) {
  const styles = useArrangeRowStyles();
  const handleMove = useCallback(
    (_from: number, to: number) => {
      onArrange(moveTile(arrangement, tile.toolId, to));
    },
    [arrangement, tile.toolId, onArrange],
  );
  const handleSize = useCallback(
    (next: ToolTileSize) => {
      onArrange(resizeTile(arrangement, tile.toolId, next));
    },
    [arrangement, tile.toolId, onArrange],
  );
  const handleHide = useCallback(() => {
    onArrange(hideTile(arrangement, tile.toolId));
  }, [arrangement, tile.toolId, onArrange]);
  const { actions, onAction } = useArrangeActions(arrangement, tile, onArrange);
  const drag = useHandleDrag({ index, count, onMove: handleMove });
  const lift = useLift(drag.offset);
  const liftedHandle = useAnimatedStyle(() => ({
    opacity: drag.offset.value === 0 ? 0 : 1,
  }));

  return (
    <Animated.View style={lift.slot} onLayout={drag.onLayout}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.drop, lift.drop]}
      />
      <Animated.View style={[styles.row, lift.row]}>
        <GestureDetector gesture={drag.pan}>
          <View
            style={styles.handle}
            importantForAccessibility="no-hide-descendants"
          >
            <InlineIcon name="dragHandle" style={styles.handleGlyph} />
            <Animated.View
              style={[StyleSheet.absoluteFill, styles.center, liftedHandle]}
            >
              <InlineIcon name="dragHandle" style={styles.handleGlyphLifted} />
            </Animated.View>
          </View>
        </GestureDetector>
        <View
          accessible
          accessibilityLabel={`${tool.name}, ${String(index + 1)} of ${String(count)}, ${SIZE_LABEL[tile.size]}`}
          accessibilityActions={actions}
          onAccessibilityAction={onAction}
          style={styles.label}
        >
          <InlineIcon name={tool.icon} style={styles.icon} />
          <Text style={styles.name} numberOfLines={1}>
            {tool.name}
          </Text>
        </View>
        <SegmentedControl
          size="row"
          options={SIZE_OPTIONS}
          selected={tile.size}
          onSelect={handleSize}
          accessibilityLabel={`${tool.name} size`}
          neighbourGapDp={homeArrange.rowInnerGap}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Hide ${tool.name}`}
          style={EYE_HIT_BOX}
          onPress={handleHide}
        >
          <View style={styles.eye}>
            <InlineIcon name="show" style={styles.eyeGlyph} />
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}
