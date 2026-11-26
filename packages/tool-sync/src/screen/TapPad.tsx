import {
  createThemedStyles,
  Icon,
  ledRadius,
  mixHex,
  size,
  space,
  stemSections,
  stemSectionsMix,
  stemSectionsText,
  textStyle,
  useTheme,
} from '@kitbag/core-design';
import { TAPS_TO_SET_TEMPO } from '@kitbag/core-state';
import { useCallback } from 'react';
import {
  Pressable,
  Text,
  View,
  type PressableStateCallbackType,
} from 'react-native';

import { TAP_PAD_MODE, type TapPadCopy } from '../logic/tapPad.ts';

const LED_INDEXES = Array.from({ length: TAPS_TO_SET_TEMPO }, (_, i) => i);

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
  leds: { flexDirection: 'row', gap: space.ledGap },
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

export function TapLeds({ landed }: { readonly landed: number }) {
  const styles = useStyles();
  return (
    <View
      accessible
      accessibilityLabel={`${String(landed)} of ${String(TAPS_TO_SET_TEMPO)} taps`}
      style={styles.leds}
    >
      {LED_INDEXES.map((index) => (
        <View key={index} style={[styles.led, index < landed && styles.lit]} />
      ))}
    </View>
  );
}

export interface TapPadProps {
  readonly copy: TapPadCopy;
  readonly tapsLanded: number;
  readonly onTap: () => void;
  readonly onRelease: () => void;
}

export function TapPad({ copy, tapsLanded, onTap, onRelease }: TapPadProps) {
  const styles = useStyles();
  const theme = useTheme();
  const padStyle = useCallback(
    ({ pressed }: PressableStateCallbackType) => [
      styles.pad,
      pressed && styles.pressed,
    ],
    [styles],
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={copy.title}
      accessibilityHint={copy.hint}
      style={padStyle}
      onPressIn={onTap}
      onPressOut={onRelease}
    >
      {copy.mode === TAP_PAD_MODE.tempo ? (
        <TapLeds landed={tapsLanded} />
      ) : (
        <Icon name="tapAlong" size="retimePad" color={theme.accentInk} />
      )}
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.hint}>{copy.hint}</Text>
    </Pressable>
  );
}
