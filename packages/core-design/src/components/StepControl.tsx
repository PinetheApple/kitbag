import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type AccessibilityActionEvent,
} from 'react-native';

import type { IconName } from '../icons.ts';
import { iconSizes, inset, radius, size, space, textRoles } from '../roles.ts';
import {
  inlineValueHitBox,
  LARGE_KEY_HEIGHT,
  largeInlineKeyHitBoxes,
  stepKeyHitBoxes,
} from '../stepHitBoxes.ts';
import { createStepRepeat, STEP_REPEAT } from '../stepRepeat.ts';
import { grownTextScale } from '../textScale.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import {
  hitBoxStyle,
  neighbourGaps,
  type NeighbourGaps,
} from '../touchTarget.ts';
import { useTextIconScale } from '../useTextIconScale.ts';
import { InlineIcon } from './IconGlyph.tsx';

export type StepDelta = -1 | 1;
export type StepControlVariant =
  'badge' | 'inline' | 'inlineLarge' | 'inlineLargeTextGlyph';

const STEP_DOWN: StepDelta = -1;
const STEP_UP: StepDelta = 1;

const INLINE_GLYPH: Readonly<
  Record<Exclude<StepControlVariant, 'badge'>, number>
> = {
  inline: textRoles.stepInline.size,
  inlineLarge: iconSizes.stepInlineLargeKey,
  inlineLargeTextGlyph: iconSizes.stepTextGlyphKey,
};

const A11Y_ACTIONS = [{ name: 'increment' }, { name: 'decrement' }] as const;
const A11Y_ACTIONS_WITH_ACTIVATE = [...A11Y_ACTIONS, { name: 'activate' }];

export interface StepControlProps {
  readonly label: string;
  readonly value: string;
  readonly suffix?: string | undefined;
  readonly accessibilityValue?: string;
  readonly onStep: (delta: StepDelta) => void;
  readonly onValuePress?: (() => void) | undefined;
  readonly variant?: StepControlVariant;
  readonly accented?: boolean;
  readonly repeatOnHold?: boolean;
  readonly wide?: boolean;
  readonly wrapValue?: boolean;
  /** Gaps to the controls around the cluster, for the keys' 48dp hit boxes;
   * a number applies to every side, an omitted side has no neighbour. */
  readonly neighbourGapDp?: number | NeighbourGaps;
}

type HitBox = ReturnType<typeof hitBoxStyle>;

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
    color: theme.color[theme.accentInk],
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
  wideValueBox: {
    minWidth: size.stepValueWideMinWidth,
  },
  tappableValue: {
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  inlineValue: {
    ...textStyle(textRoles.stepInlineValue),
    color: theme.color.text,
  },
  inlineClusterAccented: {
    backgroundColor: theme.activeControlFill,
    borderColor: theme.color.accentDim,
  },
  inlineValueAccented: {
    color: theme.color[theme.accentInk],
  },
  wrapCluster: { flexShrink: 1, maxWidth: '100%' },
  wrapValueBox: { flexShrink: 1 },
  wrapValueText: { flexShrink: 1, textAlign: 'center' },
  fixedKey: { flexShrink: 0 },
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
  largeValue: textStyle(textRoles.stepInlineLargeValue),
  suffixed: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  suffix: {
    ...textStyle(textRoles.stepValueSuffix),
    color: theme.color.text2,
  },
}));

export function StepControl({
  label,
  value,
  suffix,
  accessibilityValue,
  onStep,
  onValuePress,
  variant = 'badge',
  accented = false,
  repeatOnHold = false,
  wide = false,
  wrapValue = false,
  neighbourGapDp = space.stepKeyGap,
}: StepControlProps) {
  const styles = useStyles();
  const textScale = grownTextScale(useWindowDimensions().fontScale);
  const iconScale = useTextIconScale();
  const suffixGap = useMemo(
    () => ({ marginLeft: space.stepSuffixGap * textScale }),
    [textScale],
  );
  const valueTappable = onValuePress !== undefined;
  const textGlyph = variant === 'inlineLargeTextGlyph';
  const large = variant === 'inlineLarge' || textGlyph;
  const inline = variant === 'inline' || large;
  const glyphSize = useMemo(
    () =>
      variant === 'badge'
        ? undefined
        : { fontSize: INLINE_GLYPH[variant] * iconScale },
    [variant, iconScale],
  );
  const gaps = neighbourGaps(neighbourGapDp);
  const hitBoxes = large
    ? largeInlineKeyHitBoxes(gaps, valueTappable)
    : stepKeyHitBoxes(gaps, inline, valueTappable);

  const handleDecrement = useCallback(() => {
    onStep(STEP_DOWN);
  }, [onStep]);
  const handleIncrement = useCallback(() => {
    onStep(STEP_UP);
  }, [onStep]);
  const [repeater] = useState(createStepRepeat);
  useEffect(() => repeater.release, [repeater]);
  const holdDecrement = useCallback(() => {
    repeater.hold(handleDecrement);
  }, [repeater, handleDecrement]);
  const holdIncrement = useCallback(() => {
    repeater.hold(handleIncrement);
  }, [repeater, handleIncrement]);
  const repeatProps = (onHold: () => void) =>
    repeatOnHold
      ? {
          onLongPress: onHold,
          onPressOut: repeater.release,
          delayLongPress: STEP_REPEAT.delayMs,
        }
      : {};

  const handleAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const action = event.nativeEvent.actionName;
      if (action === 'increment') onStep(STEP_UP);
      else if (action === 'decrement') onStep(STEP_DOWN);
      else if (action === 'activate') onValuePress?.();
    },
    [onStep, onValuePress],
  );

  const key = (
    glyph: IconName,
    hitBox: HitBox,
    onPress: () => void,
    onHold: () => void,
  ) =>
    inline ? (
      <Pressable
        style={[hitBox, wrapValue && styles.fixedKey]}
        onPress={onPress}
        {...repeatProps(onHold)}
      >
        <View style={[styles.inlineKey, large && styles.largeKey]}>
          <InlineIcon name={glyph} style={[styles.inlineKeyText, glyphSize]} />
        </View>
      </Pressable>
    ) : (
      <Pressable style={hitBox} onPress={onPress} {...repeatProps(onHold)}>
        <View style={styles.badgeKey}>
          <InlineIcon name={glyph} style={styles.badgeKeyText} />
        </View>
      </Pressable>
    );

  const valueBoxStyle = inline
    ? [
        styles.inlineValueBox,
        wide && styles.wideValueBox,
        wrapValue && styles.wrapValueBox,
      ]
    : [styles.badgeValueBox, accented && styles.badgeValueBoxAccented];
  const valueNumber = (
    <Text
      style={
        inline
          ? [
              styles.inlineValue,
              large && styles.largeValue,
              accented && styles.inlineValueAccented,
              wrapValue && styles.wrapValueText,
            ]
          : [styles.badgeValue, accented && styles.badgeValueAccented]
      }
    >
      {value}
    </Text>
  );
  const valueContent =
    suffix === undefined ? (
      valueNumber
    ) : (
      <View style={styles.suffixed}>
        {valueNumber}
        <Text style={[styles.suffix, suffixGap]}>{suffix}</Text>
      </View>
    );
  const spokenValue = suffix === undefined ? value : `${value} ${suffix}`;

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: accessibilityValue ?? spokenValue }}
      accessibilityActions={
        valueTappable ? A11Y_ACTIONS_WITH_ACTIVATE : A11Y_ACTIONS
      }
      onAccessibilityAction={handleAccessibilityAction}
      style={
        inline
          ? [
              styles.inlineCluster,
              large && styles.largeCluster,
              accented && styles.inlineClusterAccented,
              wrapValue && styles.wrapCluster,
            ]
          : styles.badgeCluster
      }
    >
      {key('decrease', hitBoxes.decrement, handleDecrement, holdDecrement)}
      {valueTappable ? (
        <Pressable
          style={[
            valueBoxStyle,
            inline && [styles.tappableValue, inlineValueHitBox(gaps, large)],
          ]}
          onPress={onValuePress}
        >
          {valueContent}
        </Pressable>
      ) : (
        <View style={[valueBoxStyle, styles.inertValue]}>{valueContent}</View>
      )}
      {key('increase', hitBoxes.increment, handleIncrement, holdIncrement)}
    </View>
  );
}
