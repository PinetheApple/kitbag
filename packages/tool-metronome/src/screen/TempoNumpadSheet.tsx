// Tap-to-type tempo (SPEC §5.2, design §03 "one numpad"). Opens over the
// running metronome; nothing here stops it. The keypad never rejects a
// keypress — confirm clamps (logic/numpad).

import { radii, resolveTheme, typography } from '@kitbag/core-design';
import { BPM_BOUNDS } from '@kitbag/core-state';
import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  confirmEntry,
  openEntry,
  pressBackspace,
  pressDigit,
} from '../logic/numpad.ts';
import { DISPLAY_WEIGHT } from './typeStyles.ts';

const theme = resolveTheme('dark');

// design §03 `.numpad`: 3 columns, 8dp gaps, 19px keys, 11dp radius.
const KEY_COLUMNS = 3;
const KEY_GAP = 8;
const KEY_FONT_SIZE = 19;
const KEY_RADIUS = 11;
const KEY_PADDING_V = 13;
const SHEET_PADDING = 14;
const GRAB_WIDTH = 36;
const GRAB_HEIGHT = 4;
const TITLE_FONT_SIZE = 14;
const ENTRY_FONT_SIZE = 52;
const HINT_FONT_SIZE = 11.5;
const SHEET_GAP = 12;

const ZERO_KEY = 0;
const FIRST_DIGIT = 1;
const DIGIT_ROWS_ABOVE_ZERO = 3;

// 1-9 laid out in rows of KEY_COLUMNS, the design's grid; ⌫ 0 ✓ is the last row.
const DIGIT_ROWS = Array.from({ length: DIGIT_ROWS_ABOVE_ZERO }, (_u, row) =>
  Array.from(
    { length: KEY_COLUMNS },
    (_unused, column) => FIRST_DIGIT + row * KEY_COLUMNS + column,
  ),
);

interface DigitKeyProps {
  readonly digit: number;
  readonly onDigit: (digit: number) => void;
}

function DigitKey({ digit, onDigit }: DigitKeyProps) {
  const handlePress = useCallback(() => {
    onDigit(digit);
  }, [onDigit, digit]);

  return (
    <Pressable style={styles.key} onPress={handlePress}>
      <Text style={styles.keyText}>{digit}</Text>
    </Pressable>
  );
}

interface TempoNumpadSheetProps {
  readonly visible: boolean;
  readonly bpm: number;
  readonly onConfirm: (bpm: number) => void;
  readonly onDismiss: () => void;
}

export function TempoNumpadSheet({
  visible,
  bpm,
  onConfirm,
  onDismiss,
}: TempoNumpadSheetProps) {
  const [entry, setEntry] = useState(() => openEntry(bpm));

  const handleDigit = useCallback((digit: number) => {
    setEntry((current) => pressDigit(current, digit, BPM_BOUNDS));
  }, []);

  const handleBackspace = useCallback(() => {
    setEntry(pressBackspace);
  }, []);

  const handleConfirm = useCallback(() => {
    const typed = confirmEntry(entry, BPM_BOUNDS);
    if (typed !== undefined) onConfirm(typed);
    onDismiss();
  }, [entry, onConfirm, onDismiss]);

  // Reopening starts from the tempo now showing, not from the last entry.
  const handleShow = useCallback(() => {
    setEntry(openEntry(bpm));
  }, [bpm]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onShow={handleShow}
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.scrim} onPress={onDismiss} />
      <View style={styles.sheet}>
        <View style={styles.grab} />
        <Text style={styles.title}>Tempo</Text>
        <Text style={styles.entry}>{entry.digits}</Text>
        <Text style={styles.hint}>
          {BPM_BOUNDS.min} – {BPM_BOUNDS.max} BPM
        </Text>
        <View style={styles.pad}>
          {DIGIT_ROWS.map((row) => (
            <View key={row[0]} style={styles.padRow}>
              {row.map((digit) => (
                <DigitKey key={digit} digit={digit} onDigit={handleDigit} />
              ))}
            </View>
          ))}
          <View style={styles.padRow}>
            <Pressable style={styles.key} onPress={handleBackspace}>
              <Text style={styles.keyText}>⌫</Text>
            </Pressable>
            <DigitKey digit={ZERO_KEY} onDigit={handleDigit} />
            <Pressable
              style={[styles.key, styles.confirmKey]}
              onPress={handleConfirm}
            >
              <Text style={[styles.keyText, styles.confirmKeyText]}>✓</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
  },
  sheet: {
    backgroundColor: theme.surface1,
    borderTopLeftRadius: radii.sheetTop,
    borderTopRightRadius: radii.sheetTop,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    padding: SHEET_PADDING,
    gap: SHEET_GAP,
  },
  grab: {
    width: GRAB_WIDTH,
    height: GRAB_HEIGHT,
    borderRadius: GRAB_HEIGHT / 2,
    backgroundColor: theme.surface3,
    alignSelf: 'center',
  },
  title: {
    color: theme.text,
    fontFamily: typography.headline.family,
    fontSize: TITLE_FONT_SIZE,
  },
  entry: {
    color: theme.text,
    fontFamily: typography.display.family,
    fontWeight: DISPLAY_WEIGHT,
    fontSize: ENTRY_FONT_SIZE,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  hint: {
    color: theme.text3,
    fontSize: HINT_FONT_SIZE,
    textAlign: 'center',
  },
  pad: {
    gap: KEY_GAP,
  },
  padRow: {
    flexDirection: 'row',
    gap: KEY_GAP,
  },
  key: {
    flex: 1,
    paddingVertical: KEY_PADDING_V,
    borderRadius: KEY_RADIUS,
    backgroundColor: theme.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    alignItems: 'center',
  },
  keyText: {
    color: theme.text,
    fontFamily: typography.headline.family,
    fontSize: KEY_FONT_SIZE,
    fontVariant: ['tabular-nums'],
  },
  confirmKey: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  confirmKeyText: {
    color: theme.onAccent,
  },
});
