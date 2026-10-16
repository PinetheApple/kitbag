import { useCallback } from 'react';
import {
  Pressable,
  Text,
  View,
  type AccessibilityActionEvent,
} from 'react-native';

import { icons } from '../icons.ts';
import { inset, radius, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import {
  hitBoxStyle,
  hitExtension,
  hitSlopForPadded,
  neighbourGaps,
  type NeighbourGaps,
} from '../touchTarget.ts';

export type StepDelta = -1 | 1;
export type StepControlVariant = 'badge' | 'inline';

const STEP_DOWN: StepDelta = -1;
const STEP_UP: StepDelta = 1;

// With an inert value badge between them, the keys are at least the badge's
// padding and border apart as well as two gaps; with a tappable one, only the
// gap separates key from badge.
const INERT_BADGE_GAP = 2 * (space.stepKeyGap + inset.badgeH + size.stroke);
const INLINE_KEY_HIT_SLOP = hitSlopForPadded(
  textRoles.stepInline.size,
  inset.stepInlineKeyV,
  space.inlineKeyGap,
);

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
  /** Gaps to the controls around the cluster, for the badge keys' 48dp hit
   * boxes; a number applies to every side, an omitted side has no neighbour.
   * Defaults to the key gap on every side, the old conservative bound. */
  readonly neighbourGapDp?: number | NeighbourGaps;
}

type HitBox = ReturnType<typeof hitBoxStyle>;

function badgeKeyHitBoxes(gaps: NeighbourGaps, valueTappable: boolean) {
  const inner = valueTappable ? space.stepKeyGap : INERT_BADGE_GAP;
  const vertical = { top: gaps.top, bottom: gaps.bottom };
  return {
    decrement: hitBoxStyle(
      hitExtension(size.stepKey, size.stepKey, {
        ...vertical,
        left: gaps.left,
        right: inner,
      }),
    ),
    increment: hitBoxStyle(
      hitExtension(size.stepKey, size.stepKey, {
        ...vertical,
        left: inner,
        right: gaps.right,
      }),
    ),
  };
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
  inlineValue: {
    ...textStyle(textRoles.stepInlineValue),
    color: theme.color.text,
  },
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
  const hitBoxes = badgeKeyHitBoxes(
    neighbourGaps(neighbourGapDp),
    valueTappable,
  );

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

  const inline = variant === 'inline';

  const key = (glyph: string, hitBox: HitBox, onPress: () => void) =>
    inline ? (
      <Pressable
        style={styles.inlineKey}
        hitSlop={INLINE_KEY_HIT_SLOP}
        onPress={onPress}
      >
        <Text style={styles.inlineKeyText}>{glyph}</Text>
      </Pressable>
    ) : (
      <Pressable style={hitBox} onPress={onPress}>
        <View style={styles.badgeKey}>
          <Text style={styles.badgeKeyText}>{glyph}</Text>
        </View>
      </Pressable>
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
      style={inline ? styles.inlineCluster : styles.badgeCluster}
    >
      {key(icons.decrease, hitBoxes.decrement, handleDecrement)}
      <View
        style={
          inline
            ? styles.inlineValueBox
            : [
                styles.badgeValueBox,
                accented && styles.badgeValueBoxAccented,
                // An inert badge must not swallow the keys' hit boxes.
                !valueTappable && styles.inertValue,
              ]
        }
      >
        <Text
          style={
            inline
              ? styles.inlineValue
              : [styles.badgeValue, accented && styles.badgeValueAccented]
          }
          onPress={onValuePress}
        >
          {value}
        </Text>
      </View>
      {key(icons.increase, hitBoxes.increment, handleIncrement)}
    </View>
  );
}
