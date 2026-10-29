import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import { iconSizes, inset, radius, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { hitSlopFor, hitSlopForPadded } from '../touchTarget.ts';
import { InlineIcon } from './IconGlyph.tsx';

const COLUMNS = 3;
const ROWS_ABOVE_ZERO = 3;
const FIRST_DIGIT = 1;
const ZERO = 0;

const DIGIT_ROWS = Array.from({ length: ROWS_ABOVE_ZERO }, (_u, row) =>
  Array.from(
    { length: COLUMNS },
    (_unused, column) => FIRST_DIGIT + row * COLUMNS + column,
  ),
);

const KEY_HIT_SLOP = hitSlopForPadded(
  textRoles.numpadKey.size,
  inset.numpadKeyV,
  space.controlGap,
);

export type NumpadKeypadSize = 'default' | 'large';

const HIT_SLOP: Readonly<Record<NumpadKeypadSize, number>> = {
  default: KEY_HIT_SLOP,
  large: hitSlopFor(size.numpadKeyLarge, space.controlGap),
};

interface DigitKeyProps {
  readonly digit: number;
  readonly onDigit: (digit: number) => void;
  readonly keySize: NumpadKeypadSize;
}

const useStyles = createThemedStyles((theme) => ({
  pad: {
    gap: space.controlGap,
  },
  row: {
    flexDirection: 'row',
    gap: space.controlGap,
  },
  key: {
    flex: 1,
    paddingVertical: inset.numpadKeyV,
    borderRadius: radius.numpadKey,
    backgroundColor: theme.color.surface2,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    alignItems: 'center',
  },
  keyText: {
    ...textStyle(textRoles.numpadKey),
    color: theme.color.text,
  },
  confirmKey: {
    backgroundColor: theme.color.accent,
    borderColor: theme.color.accent,
  },
  confirmKeyText: {
    color: theme.color.onAccent,
  },
  largeKey: {
    minHeight: size.numpadKeyLarge,
    paddingVertical: 0,
    justifyContent: 'center',
    borderRadius: radius.numpadKeyLarge,
  },
  largeKeyText: textStyle(textRoles.numpadKeyLarge),
  largeKeyGlyph: {
    fontSize: iconSizes.numpadKeyLarge,
  },
}));

function DigitKey({ digit, onDigit, keySize }: DigitKeyProps) {
  const styles = useStyles();
  const large = keySize === 'large';
  const handlePress = useCallback(() => {
    onDigit(digit);
  }, [onDigit, digit]);

  return (
    <Pressable
      accessibilityRole="button"
      style={[styles.key, large && styles.largeKey]}
      hitSlop={HIT_SLOP[keySize]}
      onPress={handlePress}
    >
      <Text style={[styles.keyText, large && styles.largeKeyText]}>
        {digit}
      </Text>
    </Pressable>
  );
}

export interface NumpadKeypadProps {
  readonly onDigit: (digit: number) => void;
  readonly onBackspace: () => void;
  readonly onConfirm: () => void;
  readonly backspaceLabel: string;
  readonly confirmLabel: string;
  readonly size?: NumpadKeypadSize;
}

export function NumpadKeypad({
  onDigit,
  onBackspace,
  onConfirm,
  backspaceLabel,
  confirmLabel,
  size: keySize = 'default',
}: NumpadKeypadProps) {
  const styles = useStyles();
  const large = keySize === 'large';
  const keyStyle = [styles.key, large && styles.largeKey];
  const glyphStyle = [styles.keyText, large && styles.largeKeyGlyph];
  return (
    <View style={styles.pad}>
      {DIGIT_ROWS.map((row) => (
        <View key={row[0]} style={styles.row}>
          {row.map((digit) => (
            <DigitKey
              key={digit}
              digit={digit}
              keySize={keySize}
              onDigit={onDigit}
            />
          ))}
        </View>
      ))}
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backspaceLabel}
          style={keyStyle}
          hitSlop={HIT_SLOP[keySize]}
          onPress={onBackspace}
        >
          <InlineIcon name="backspace" style={glyphStyle} />
        </Pressable>
        <DigitKey digit={ZERO} keySize={keySize} onDigit={onDigit} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={confirmLabel}
          style={[keyStyle, styles.confirmKey]}
          hitSlop={HIT_SLOP[keySize]}
          onPress={onConfirm}
        >
          <InlineIcon
            name="confirm"
            style={[glyphStyle, styles.confirmKeyText]}
          />
        </Pressable>
      </View>
    </View>
  );
}
