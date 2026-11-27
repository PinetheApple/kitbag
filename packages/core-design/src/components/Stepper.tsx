import { Pressable, Text, View } from 'react-native';

import type { IconName } from '../icons.ts';
import { opacity, size } from '../roles.ts';
import { stepper, stepperText } from '../stepperRoles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { hitBoxStyle, hitExtension } from '../touchTarget.ts';
import { Icon } from './Icon.tsx';

const KEY_HIT_BOX = hitBoxStyle(
  hitExtension(stepper.key, stepper.height, {
    left: stepper.gap,
    right: stepper.gap,
  }),
);

const useStyles = createThemedStyles((theme) => ({
  stepper: {
    minHeight: stepper.height,
    paddingHorizontal: stepper.inset,
    flexDirection: 'row',
    alignItems: 'center',
    gap: stepper.gap,
    borderRadius: stepper.radius,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface2,
  },
  on: {
    borderColor: theme.color.accentDim,
    backgroundColor: theme.activeControlFill,
  },
  key: {
    width: stepper.key,
    minHeight: stepper.key,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    ...textStyle(stepperText.value),
    minWidth: stepper.value,
    color: theme.color.text,
    textAlign: 'center',
  },
  valueOn: { color: theme.color[theme.accentInk] },
  disabled: { opacity: opacity.muted },
}));

export interface StepperKeys {
  readonly earlier: IconName;
  readonly later: IconName;
  readonly earlierLabel: string;
  readonly laterLabel: string;
}

export interface StepperProps {
  readonly value: string;
  readonly keys: StepperKeys;
  readonly onEarlier: () => void;
  readonly onLater: () => void;
  readonly onValuePress?: () => void;
  readonly valueLabel?: string;
  readonly tone?: 'plain' | 'on';
  readonly disabled?: boolean;
  readonly disabledHint?: string;
}

function StepperValue({
  value,
  valueLabel,
  onValuePress,
  tone,
}: Pick<StepperProps, 'value' | 'valueLabel' | 'onValuePress' | 'tone'>) {
  const styles = useStyles();
  const text = (
    <Text style={[styles.value, tone === 'on' && styles.valueOn]}>{value}</Text>
  );
  if (onValuePress === undefined) return text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={valueLabel}
      onPress={onValuePress}
    >
      {text}
    </Pressable>
  );
}

export function Stepper({
  keys,
  onEarlier,
  onLater,
  tone = 'plain',
  disabled = false,
  disabledHint,
  ...display
}: StepperProps) {
  const styles = useStyles();
  const keyHint =
    disabled && disabledHint !== undefined
      ? { accessibilityHint: disabledHint }
      : {};
  return (
    <View
      accessibilityState={{ disabled }}
      style={[
        styles.stepper,
        tone === 'on' && styles.on,
        disabled && styles.disabled,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={keys.earlierLabel}
        accessibilityState={{ disabled }}
        {...keyHint}
        disabled={disabled}
        style={[styles.key, KEY_HIT_BOX]}
        onPress={onEarlier}
      >
        <Icon name={keys.earlier} size="lyricsChip" color="text2" />
      </Pressable>
      <StepperValue {...display} tone={tone} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={keys.laterLabel}
        accessibilityState={{ disabled }}
        {...keyHint}
        disabled={disabled}
        style={[styles.key, KEY_HIT_BOX]}
        onPress={onLater}
      >
        <Icon name={keys.later} size="lyricsChip" color="text2" />
      </Pressable>
    </View>
  );
}
