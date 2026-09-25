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
import { hitSlopFor, hitSlopForPadded } from '../touchTarget.ts';

export type StepDelta = -1 | 1;
export type StepControlVariant = 'badge' | 'inline';

const STEP_DOWN: StepDelta = -1;
const STEP_UP: StepDelta = 1;

const BADGE_KEY_HIT_SLOP = hitSlopFor(size.stepKey, space.stepKeyGap);
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
}

export function StepControl({
  label,
  value,
  accessibilityValue,
  onStep,
  onValuePress,
  variant = 'badge',
  accented = false,
}: StepControlProps) {
  const styles = useStyles();

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
  const keyHitSlop = inline ? INLINE_KEY_HIT_SLOP : BADGE_KEY_HIT_SLOP;

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: accessibilityValue ?? value }}
      accessibilityActions={
        onValuePress === undefined ? A11Y_ACTIONS : A11Y_ACTIONS_WITH_ACTIVATE
      }
      onAccessibilityAction={handleAccessibilityAction}
      style={inline ? styles.inlineCluster : styles.badgeCluster}
    >
      <Pressable
        style={inline ? styles.inlineKey : styles.badgeKey}
        hitSlop={keyHitSlop}
        onPress={handleDecrement}
      >
        <Text style={inline ? styles.inlineKeyText : styles.badgeKeyText}>
          {icons.decrease}
        </Text>
      </Pressable>
      <View
        style={
          inline
            ? styles.inlineValueBox
            : [styles.badgeValueBox, accented && styles.badgeValueBoxAccented]
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
      <Pressable
        style={inline ? styles.inlineKey : styles.badgeKey}
        hitSlop={keyHitSlop}
        onPress={handleIncrement}
      >
        <Text style={inline ? styles.inlineKeyText : styles.badgeKeyText}>
          {icons.increase}
        </Text>
      </Pressable>
    </View>
  );
}

const useStyles = createThemedStyles((theme) => ({
  badgeCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.stepKeyGap,
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
