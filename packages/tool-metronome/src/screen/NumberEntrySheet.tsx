import {
  confirmNumpadEntry,
  numpadBoundsHint,
  numpadDigits,
  numpadEntryLabel,
  NumpadKeypad,
  NumpadReadout,
  openNumpadEntry,
  pressNumpadBackspace,
  pressNumpadDigit,
  Sheet,
} from '@kitbag/core-design';
import { useCallback, useState } from 'react';

import type { BpmBounds } from '@kitbag/core-state';

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
  const [entry, setEntry] = useState(() => openNumpadEntry(value));

  const handleDigit = useCallback(
    (digit: number) => {
      setEntry((current) => pressNumpadDigit(current, digit, bounds));
    },
    [bounds],
  );

  const handleBackspace = useCallback(() => {
    setEntry(pressNumpadBackspace);
  }, []);

  const handleConfirm = useCallback(() => {
    const typed = confirmNumpadEntry(entry, bounds);
    if (typed !== undefined) onConfirm(typed);
    onDismiss();
  }, [entry, bounds, onConfirm, onDismiss]);

  const handleShow = useCallback(() => {
    setEntry(openNumpadEntry(value));
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
      <NumpadReadout
        digits={numpadDigits(entry)}
        accessibilityLabel={numpadEntryLabel(entry, title, unit)}
        hint={numpadBoundsHint(bounds, unit)}
      />
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
