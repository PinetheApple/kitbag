import {
  Button,
  Sheet,
  StepControl,
  type StepDelta,
} from '@kitbag/core-design';
import { useCallback } from 'react';

import { stepA4, type A4Range } from '../logic/a4.ts';

// No drawing exists for this sheet (SPEC §12.8); it is built from existing
// primitives and awaits design sign-off (docs/decisions.md, 2026-10-14).
export interface A4SheetProps {
  readonly visible: boolean;
  readonly hz: number;
  readonly range: A4Range;
  readonly bottomInset: number;
  readonly onChange: (hz: number) => void;
  readonly onDismiss: () => void;
}

export function A4Sheet({
  visible,
  hz,
  range,
  bottomInset,
  onChange,
  onDismiss,
}: A4SheetProps) {
  const handleStep = useCallback(
    (delta: StepDelta) => {
      onChange(stepA4(hz, delta, range));
    },
    [hz, range, onChange],
  );

  const handleReset = useCallback(() => {
    onChange(range.default);
  }, [range.default, onChange]);

  return (
    <Sheet
      visible={visible}
      title="A4 reference"
      hint={`${String(range.min)}–${String(range.max)} Hz`}
      dismissLabel="Close A4 reference"
      bottomInset={bottomInset}
      onDismiss={onDismiss}
    >
      <StepControl
        variant="inline"
        label="A4 reference"
        value={`${String(hz)} Hz`}
        onStep={handleStep}
      />
      <Button
        label={`Reset to ${String(range.default)} Hz`}
        variant="ghost"
        disabled={hz === range.default}
        onPress={handleReset}
      />
    </Sheet>
  );
}
