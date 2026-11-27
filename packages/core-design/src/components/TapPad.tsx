import { useCallback, type ReactNode } from 'react';
import {
  Pressable,
  Text,
  View,
  type GestureResponderEvent,
  type PressableStateCallbackType,
} from 'react-native';

import { size, space } from '../roles.ts';
import {
  stemSections,
  stemSectionsMix,
  stemSectionsText,
} from '../stemPlayerRoles.ts';
import { textStyle } from '../textStyle.ts';
import { mixHex } from '../theme.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { ledRadius } from '../tokens.ts';

const useStyles = createThemedStyles((theme) => ({
  pad: {
    minHeight: stemSections.padMinHeight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: stemSections.padGap,
    borderRadius: stemSections.padRadius,
    borderWidth: stemSections.padBorder,
    borderStyle: 'dashed',
    borderColor: theme.color.accentDim,
    backgroundColor: mixHex(
      theme.color.accent,
      theme.color.surface2,
      stemSectionsMix.pad,
    ),
  },
  pressed: { borderStyle: 'solid', borderColor: theme.color.accent },
  title: {
    ...textStyle(stemSectionsText.padTitle),
    color: theme.color.text,
    textAlign: 'center',
  },
  hint: {
    ...textStyle(stemSectionsText.padHint),
    color: theme.color.text2,
    textAlign: 'center',
  },
  leds: { flexDirection: 'row', justifyContent: 'center', gap: space.ledGap },
  led: {
    width: size.ledMain,
    height: size.ledMain,
    borderRadius: ledRadius,
    borderWidth: size.ledMainBorder,
    backgroundColor: theme.color.surface2,
    borderColor: theme.color.line,
  },
  lit: { backgroundColor: theme.color.accent, borderColor: theme.color.accent },
}));

export interface TapLedsProps {
  readonly landed: number;
  readonly total: number;
}

export function TapLeds({ landed, total }: TapLedsProps) {
  const styles = useStyles();
  return (
    <View
      accessible
      accessibilityLabel={`${String(landed)} of ${String(total)} taps`}
      style={styles.leds}
    >
      {Array.from({ length: total }, (_u, index) => (
        <View key={index} style={[styles.led, index < landed && styles.lit]} />
      ))}
    </View>
  );
}

export interface TapPadProps {
  readonly title: string;
  readonly hint: string;
  readonly onTap: (event: GestureResponderEvent) => void;
  readonly onRelease?: (() => void) | undefined;
  readonly minHeight?: number | null | undefined;
  readonly children: ReactNode;
}

export function TapPad({
  title,
  hint,
  onTap,
  onRelease,
  minHeight,
  children,
}: TapPadProps) {
  const styles = useStyles();
  const padStyle = useCallback(
    ({ pressed }: PressableStateCallbackType) => [
      styles.pad,
      typeof minHeight === 'number' && { minHeight },
      pressed && styles.pressed,
    ],
    [styles, minHeight],
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={hint}
      style={padStyle}
      onPressIn={onTap}
      onPressOut={onRelease}
    >
      {children}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.hint}>{hint}</Text>
    </Pressable>
  );
}
