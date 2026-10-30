import {
  createThemedStyles,
  NumpadKeypad,
  Sheet,
  SheetHint,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import type { BpmBounds } from '../logic/bpmBounds.ts';
import {
  confirmEntry,
  openEntry,
  pressBackspace,
  pressDigit,
} from '../logic/numpad.ts';

interface NumberEntrySheetProps {
  readonly visible: boolean;
  readonly title: string;
  readonly confirmLabel: string;
  readonly value: number;
  readonly bounds: BpmBounds;
  readonly unit: string;
  readonly bottomInset: number;
  readonly onConfirm: (value: number) => void;
  readonly onDismiss: () => void;
}

const useStyles = createThemedStyles((theme) => ({
  entry: {
    ...textStyle(textRoles.sheetNumeral),
    color: theme.color.text,
    textAlign: 'center',
  },
}));

export function NumberEntrySheet({
  visible,
  title,
  confirmLabel,
  value,
  bounds,
  unit,
  bottomInset,
  onConfirm,
  onDismiss,
}: NumberEntrySheetProps) {
  const styles = useStyles();
  const [entry, setEntry] = useState(() => openEntry(value));

  const handleDigit = useCallback(
    (digit: number) => {
      setEntry((current) => pressDigit(current, digit, bounds));
    },
    [bounds],
  );

  const handleBackspace = useCallback(() => {
    setEntry(pressBackspace);
  }, []);

  const handleConfirm = useCallback(() => {
    const typed = confirmEntry(entry, bounds);
    if (typed !== undefined) onConfirm(typed);
    onDismiss();
  }, [entry, bounds, onConfirm, onDismiss]);

  const handleShow = useCallback(() => {
    setEntry(openEntry(value));
  }, [value]);

  return (
    <Sheet
      visible={visible}
      title={title}
      dismissLabel={`Close ${title.toLowerCase()} entry`}
      bottomInset={bottomInset}
      dim
      onShow={handleShow}
      onDismiss={onDismiss}
    >
      <View>
        <Text
          style={styles.entry}
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${title}, ${entry.digits} ${unit}`}
        >
          {entry.digits}
        </Text>
        <SheetHint centered size="large">
          {bounds.min} – {bounds.max} {unit}
        </SheetHint>
      </View>
      <NumpadKeypad
        size="large"
        onDigit={handleDigit}
        onBackspace={handleBackspace}
        onConfirm={handleConfirm}
        backspaceLabel="Delete digit"
        confirmLabel={confirmLabel}
      />
    </Sheet>
  );
}
