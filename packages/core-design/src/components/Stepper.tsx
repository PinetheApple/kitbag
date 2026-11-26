import { Pressable, Text, View } from 'react-native';

import type { IconName } from '../icons.ts';
import { opacity, size } from '../roles.ts';
import { stemSections, stemSectionsText } from '../stemPlayerRoles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { hitBoxStyle, hitExtension } from '../touchTarget.ts';
import { Icon } from './Icon.tsx';

const KEY_HIT_BOX = hitBoxStyle(
  hitExtension(stemSections.stepperKey, stemSections.stepperHeight, {
    left: stemSections.stepperGap,
    right: stemSections.stepperGap,
  }),
);

const useStyles = createThemedStyles((theme) => ({
  stepper: {
    minHeight: stemSections.stepperHeight,
    paddingHorizontal: stemSections.stepperH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: stemSections.stepperGap,
    borderRadius: stemSections.stepperRadius,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface2,
  },
  on: {
    borderColor: theme.color.accentDim,
    backgroundColor: theme.activeControlFill,
  },
  key: {
    width: stemSections.stepperKey,
    minHeight: stemSections.stepperKey,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    ...textStyle(stemSectionsText.stepValue),
    minWidth: stemSections.stepperValue,
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
  readonly accessibilityLabel?: string;
  readonly tone?: 'plain' | 'on';
  readonly disabled?: boolean;
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
  accessibilityLabel,
  ...value
}: StepperProps) {
  const styles = useStyles();
  return (
    <View
      accessibilityLabel={accessibilityLabel}
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
        disabled={disabled}
        style={[styles.key, KEY_HIT_BOX]}
        onPress={onEarlier}
      >
        <Icon name={keys.earlier} size="lyricsChip" color="text2" />
      </Pressable>
      <StepperValue {...value} tone={tone} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={keys.laterLabel}
        accessibilityState={{ disabled }}
        disabled={disabled}
        style={[styles.key, KEY_HIT_BOX]}
        onPress={onLater}
      >
        <Icon name={keys.later} size="lyricsChip" color="text2" />
      </Pressable>
    </View>
  );
}
