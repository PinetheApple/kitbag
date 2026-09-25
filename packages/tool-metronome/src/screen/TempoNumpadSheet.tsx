import {
  createThemedStyles,
  NumpadKeypad,
  Sheet,
  SheetHint,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import { BPM_BOUNDS } from '@kitbag/core-state';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import {
  confirmEntry,
  openEntry,
  pressBackspace,
  pressDigit,
} from '../logic/numpad.ts';

interface TempoNumpadSheetProps {
  readonly visible: boolean;
  readonly bpm: number;
  readonly bottomInset: number;
  readonly onConfirm: (bpm: number) => void;
  readonly onDismiss: () => void;
}

export function TempoNumpadSheet({
  visible,
  bpm,
  bottomInset,
  onConfirm,
  onDismiss,
}: TempoNumpadSheetProps) {
  const styles = useStyles();
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

  const handleShow = useCallback(() => {
    setEntry(openEntry(bpm));
  }, [bpm]);

  return (
    <Sheet
      visible={visible}
      title="Tempo"
      dismissLabel="Close tempo entry"
      bottomInset={bottomInset}
      onShow={handleShow}
      onDismiss={onDismiss}
    >
      <View>
        <Text
          style={styles.entry}
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${entry.digits} BPM`}
        >
          {entry.digits}
        </Text>
        <SheetHint centered>
          {BPM_BOUNDS.min} – {BPM_BOUNDS.max} BPM
        </SheetHint>
      </View>
      <NumpadKeypad
        onDigit={handleDigit}
        onBackspace={handleBackspace}
        onConfirm={handleConfirm}
        backspaceLabel="Delete digit"
        confirmLabel="Set tempo"
      />
    </Sheet>
  );
}

const useStyles = createThemedStyles((theme) => ({
  entry: {
    ...textStyle(textRoles.sheetNumeral),
    color: theme.color.text,
    textAlign: 'center',
  },
}));
