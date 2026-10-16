import {
  Button,
  Sheet,
  SHEET_TOUCH_ROOM,
  space,
  StepControl,
  unshared,
  type StepDelta,
} from '@kitbag/core-design';
import { useCallback } from 'react';

import { stepA4, type A4Range } from '../logic/a4.ts';

const STEPPER_GAPS = {
  top: unshared(SHEET_TOUCH_ROOM),
  left: unshared(SHEET_TOUCH_ROOM),
  bottom: space.sectionGap,
};
const RESET_GAPS = {
  top: space.sectionGap,
  bottom: unshared(space.sectionGap),
};

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
        neighbourGapDp={STEPPER_GAPS}
        onStep={handleStep}
      />
      <Button
        label={`Reset to ${String(range.default)} Hz`}
        variant="ghost"
        disabled={hz === range.default}
        neighbourGapDp={RESET_GAPS}
        onPress={handleReset}
      />
    </Sheet>
  );
}
