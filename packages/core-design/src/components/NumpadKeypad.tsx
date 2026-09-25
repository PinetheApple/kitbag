import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import { icons } from '../icons.ts';
import { inset, radius, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { hitSlopForPadded } from '../touchTarget.ts';

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

interface DigitKeyProps {
  readonly digit: number;
  readonly onDigit: (digit: number) => void;
}

function DigitKey({ digit, onDigit }: DigitKeyProps) {
  const styles = useStyles();
  const handlePress = useCallback(() => {
    onDigit(digit);
  }, [onDigit, digit]);

  return (
    <Pressable
      accessibilityRole="button"
      style={styles.key}
      hitSlop={KEY_HIT_SLOP}
      onPress={handlePress}
    >
      <Text style={styles.keyText}>{digit}</Text>
    </Pressable>
  );
}

export interface NumpadKeypadProps {
  readonly onDigit: (digit: number) => void;
  readonly onBackspace: () => void;
  readonly onConfirm: () => void;
  readonly backspaceLabel: string;
  readonly confirmLabel: string;
}

export function NumpadKeypad({
  onDigit,
  onBackspace,
  onConfirm,
  backspaceLabel,
  confirmLabel,
}: NumpadKeypadProps) {
  const styles = useStyles();
  return (
    <View style={styles.pad}>
      {DIGIT_ROWS.map((row) => (
        <View key={row[0]} style={styles.row}>
          {row.map((digit) => (
            <DigitKey key={digit} digit={digit} onDigit={onDigit} />
          ))}
        </View>
      ))}
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backspaceLabel}
          style={styles.key}
          hitSlop={KEY_HIT_SLOP}
          onPress={onBackspace}
        >
          <Text style={styles.keyText}>{icons.backspace}</Text>
        </Pressable>
        <DigitKey digit={ZERO} onDigit={onDigit} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={confirmLabel}
          style={[styles.key, styles.confirmKey]}
          hitSlop={KEY_HIT_SLOP}
          onPress={onConfirm}
        >
          <Text style={[styles.keyText, styles.confirmKeyText]}>
            {icons.confirm}
          </Text>
        </Pressable>
      </View>
    </View>
  );
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
}));
