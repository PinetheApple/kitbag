import { useCallback } from 'react';
import {
  Pressable,
  Text,
  View,
  type AccessibilityActionEvent,
} from 'react-native';

import type { IconName } from '../icons.ts';
import { iconSizes, inset, radius, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { minTouchTargetDp } from '../tokens.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import {
  hitBoxStyle,
  hitExtension,
  neighbourGaps,
  unshared,
  type NeighbourGaps,
} from '../touchTarget.ts';
import { InlineIcon } from './IconGlyph.tsx';

export type StepDelta = -1 | 1;
export type StepControlVariant = 'badge' | 'inline' | 'inlineLarge';

const STEP_DOWN: StepDelta = -1;
const STEP_UP: StepDelta = 1;

// With an inert value badge between them, the keys are at least the badge's
// padding and border apart as well as two gaps; with a tappable one, only the
// gap separates key from badge.
const INERT_BADGE_GAP = 2 * (space.stepKeyGap + inset.badgeH + size.stroke);

// The inline key's width leaves out its glyph, so the box is a lower bound. An
// inert value lets the two keys meet at its midpoint.
const INLINE_KEY_WIDTH = inset.stepInlineKeyH * 2;
const INLINE_KEY_HEIGHT = textRoles.stepInline.size + inset.stepInlineKeyV * 2;
const INLINE_INNER_GAP = space.inlineKeyGap * 2 + size.stepValueMinWidth;
const INLINE_EDGE_H = inset.stepInlineH + size.stroke;
const INLINE_EDGE_V = inset.stepInlineV + size.stroke;

const LARGE_KEY_HEIGHT = size.stepInlineLarge - size.stroke * 2;
const LARGE_EDGE_H = inset.stepInlineLargeH + size.stroke;

const halfShortfall = (extent: number) =>
  Math.max(0, (minTouchTargetDp - extent) / 2);

const VALUE_ROW_HEIGHT: Readonly<Record<StepControlVariant, number>> = {
  badge: size.stepKey,
  inline: INLINE_KEY_HEIGHT + INLINE_EDGE_V * 2,
  inlineLarge: size.stepInlineLarge,
};

function valueHitSlop(variant: StepControlVariant) {
  const vertical = halfShortfall(VALUE_ROW_HEIGHT[variant]);
  const horizontal =
    variant === 'badge' ? 0 : halfShortfall(size.stepValueMinWidth);
  return {
    top: vertical,
    bottom: vertical,
    left: horizontal,
    right: horizontal,
  };
}

const A11Y_ACTIONS = [{ name: 'increment' }, { name: 'decrement' }] as const;
const A11Y_ACTIONS_WITH_ACTIVATE = [...A11Y_ACTIONS, { name: 'activate' }];

export interface StepControlProps {
  readonly label: string;
  readonly value: string;
  readonly accessibilityValue?: string;
  readonly onStep: (delta: StepDelta) => void;
  readonly onValuePress?: () => void;
  readonly variant?: StepControlVariant;
  readonly accented?: boolean;
  /** Gaps to the controls around the cluster, for the keys' 48dp hit boxes;
   * a number applies to every side, an omitted side has no neighbour. */
  readonly neighbourGapDp?: number | NeighbourGaps;
}

type HitBox = ReturnType<typeof hitBoxStyle>;

interface KeyGeometry {
  readonly width: number;
  readonly height: number;
  readonly inner: number;
  readonly gaps: NeighbourGaps;
}

function keyHitBoxes({ width, height, inner, gaps }: KeyGeometry) {
  const vertical = { top: gaps.top, bottom: gaps.bottom };
  return {
    decrement: hitBoxStyle(
      hitExtension(width, height, {
        ...vertical,
        left: gaps.left,
        right: inner,
      }),
    ),
    increment: hitBoxStyle(
      hitExtension(width, height, {
        ...vertical,
        left: inner,
        right: gaps.right,
      }),
    ),
  };
}

const plus = (edge: number, gap: number | undefined) =>
  unshared(edge) + (gap ?? Number.POSITIVE_INFINITY);

function largeInlineKeyHitBoxes(gaps: NeighbourGaps, valueTappable: boolean) {
  return keyHitBoxes({
    width: size.stepInlineLargeKey,
    height: LARGE_KEY_HEIGHT,
    inner: valueTappable ? space.inlineKeyGap : INLINE_INNER_GAP,
    gaps: {
      top: plus(size.stroke, gaps.top),
      bottom: plus(size.stroke, gaps.bottom),
      left: plus(LARGE_EDGE_H, gaps.left),
      right: plus(LARGE_EDGE_H, gaps.right),
    },
  });
}

function stepKeyHitBoxes(
  gaps: NeighbourGaps,
  inline: boolean,
  valueTappable: boolean,
) {
  if (!inline) {
    return keyHitBoxes({
      width: size.stepKey,
      height: size.stepKey,
      inner: valueTappable ? space.stepKeyGap : INERT_BADGE_GAP,
      gaps,
    });
  }
  return keyHitBoxes({
    width: INLINE_KEY_WIDTH,
    height: INLINE_KEY_HEIGHT,
    inner: valueTappable ? space.inlineKeyGap : INLINE_INNER_GAP,
    gaps: {
      top: plus(INLINE_EDGE_V, gaps.top),
      bottom: plus(INLINE_EDGE_V, gaps.bottom),
      left: plus(INLINE_EDGE_H, gaps.left),
      right: plus(INLINE_EDGE_H, gaps.right),
    },
  });
}

const useStyles = createThemedStyles((theme) => ({
  badgeCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.stepKeyGap,
  },
  inertValue: {
    pointerEvents: 'none',
  },
  badgeKey: {
    minWidth: size.stepKey,
    minHeight: size.stepKey,
    borderRadius: radius.stepKey,
    backgroundColor: theme.color.surface2,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeKeyText: {
    ...textStyle(textRoles.stepKey),
    color: theme.color.text2,
  },
  badgeValueBox: {
    paddingHorizontal: inset.badgeH,
    paddingVertical: inset.badgeV,
    borderRadius: radius.badge,
    backgroundColor: theme.color.surface2,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
  },
  badgeValueBoxAccented: {
    borderColor: theme.color.accentDim,
  },
  badgeValue: {
    ...textStyle(textRoles.badge),
    fontVariant: ['tabular-nums'],
    color: theme.color.text2,
  },
  badgeValueAccented: {
    color: theme.color.accent,
  },
  inlineCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.inlineKeyGap,
    paddingVertical: inset.stepInlineV,
    paddingHorizontal: inset.stepInlineH,
    borderRadius: radius.stepInline,
    backgroundColor: theme.color.surface2,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
  },
  inlineKey: {
    paddingVertical: inset.stepInlineKeyV,
    paddingHorizontal: inset.stepInlineKeyH,
    borderRadius: radius.stepInlineKey,
  },
  inlineKeyText: {
    ...textStyle(textRoles.stepInline),
    color: theme.color.text2,
  },
  inlineValueBox: {
    minWidth: size.stepValueMinWidth,
    alignItems: 'center',
  },
  tappableValue: {
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  keyOnTop: {
    zIndex: 1,
  },
  inlineValue: {
    ...textStyle(textRoles.stepInlineValue),
    color: theme.color.text,
  },
  largeCluster: {
    minHeight: size.stepInlineLarge,
    paddingVertical: 0,
    paddingHorizontal: inset.stepInlineLargeH,
    borderRadius: radius.stepInlineLarge,
  },
  largeKey: {
    width: size.stepInlineLargeKey,
    minHeight: LARGE_KEY_HEIGHT,
    paddingVertical: 0,
    paddingHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeKeyText: {
    fontSize: iconSizes.stepInlineLargeKey,
  },
  largeValue: textStyle(textRoles.stepInlineLargeValue),
}));

export function StepControl({
  label,
  value,
  accessibilityValue,
  onStep,
  onValuePress,
  variant = 'badge',
  accented = false,
  neighbourGapDp = space.stepKeyGap,
}: StepControlProps) {
  const styles = useStyles();
  const valueTappable = onValuePress !== undefined;
  const large = variant === 'inlineLarge';
  const inline = variant === 'inline' || large;
  const hitBoxes = large
    ? largeInlineKeyHitBoxes(neighbourGaps(neighbourGapDp), valueTappable)
    : stepKeyHitBoxes(neighbourGaps(neighbourGapDp), inline, valueTappable);

  const handleDecrement = useCallback(() => {
    onStep(STEP_DOWN);
  }, [onStep]);
  const handleIncrement = useCallback(() => {
    onStep(STEP_UP);
  }, [onStep]);

  const handleAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const action = event.nativeEvent.actionName;
      if (action === 'increment') onStep(STEP_UP);
      else if (action === 'decrement') onStep(STEP_DOWN);
      else if (action === 'activate') onValuePress?.();
    },
    [onStep, onValuePress],
  );

  const key = (glyph: IconName, hitBox: HitBox, onPress: () => void) =>
    inline ? (
      <Pressable style={[hitBox, styles.keyOnTop]} onPress={onPress}>
        <View style={[styles.inlineKey, large && styles.largeKey]}>
          <InlineIcon
            name={glyph}
            style={[styles.inlineKeyText, large && styles.largeKeyText]}
          />
        </View>
      </Pressable>
    ) : (
      <Pressable style={[hitBox, styles.keyOnTop]} onPress={onPress}>
        <View style={styles.badgeKey}>
          <InlineIcon name={glyph} style={styles.badgeKeyText} />
        </View>
      </Pressable>
    );

  const valueBoxStyle = inline
    ? styles.inlineValueBox
    : [styles.badgeValueBox, accented && styles.badgeValueBoxAccented];
  const valueText = (
    <Text
      style={
        inline
          ? [styles.inlineValue, large && styles.largeValue]
          : [styles.badgeValue, accented && styles.badgeValueAccented]
      }
    >
      {value}
    </Text>
  );

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: accessibilityValue ?? value }}
      accessibilityActions={
        valueTappable ? A11Y_ACTIONS_WITH_ACTIVATE : A11Y_ACTIONS
      }
      onAccessibilityAction={handleAccessibilityAction}
      style={
        inline
          ? [styles.inlineCluster, large && styles.largeCluster]
          : styles.badgeCluster
      }
    >
      {key('decrease', hitBoxes.decrement, handleDecrement)}
      {valueTappable ? (
        <Pressable
          style={[valueBoxStyle, styles.tappableValue]}
          hitSlop={valueHitSlop(variant)}
          onPress={onValuePress}
        >
          {valueText}
        </Pressable>
      ) : (
        <View style={[valueBoxStyle, styles.inertValue]}>{valueText}</View>
      )}
      {key('increase', hitBoxes.increment, handleIncrement)}
    </View>
  );
}
