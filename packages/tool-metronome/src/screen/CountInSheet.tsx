import { PickerGrid, SegmentedControl, Sheet } from '@kitbag/core-design';
import { useMetronome } from '@kitbag/core-state';
import { useCallback } from 'react';

import {
  COUNT_IN_BAR_OPTIONS,
  COUNT_IN_MODE,
  COUNT_IN_MODE_OPTIONS,
  countInBarsFromOption,
  type CountInMode,
} from '../logic/countIn.ts';

interface CountInSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

function useCountInEdits() {
  const countIn = useMetronome((state) => state.countIn);
  const setCountIn = useMetronome((state) => state.setCountIn);
  const pickBars = useCallback(
    (value: string) => {
      setCountIn({ ...countIn, bars: countInBarsFromOption(value) });
    },
    [countIn, setCountIn],
  );
  const pickMode = useCallback(
    (mode: CountInMode) => {
      setCountIn({ ...countIn, distinct: mode === COUNT_IN_MODE.distinct });
    },
    [countIn, setCountIn],
  );
  const mode = countIn.distinct ? COUNT_IN_MODE.distinct : COUNT_IN_MODE.same;
  return { bars: String(countIn.bars), mode, pickBars, pickMode };
}

export function CountInSheet({
  visible,
  bottomInset,
  onDismiss,
}: CountInSheetProps) {
  const { bars, mode, pickBars, pickMode } = useCountInEdits();
  return (
    <Sheet
      visible={visible}
      title="Count-in"
      titleIcon="countIn"
      hint="Counts in on start only, never after a pause mid-bar. A distinct sound is the default so you can hear the difference between the count and the one."
      dismissLabel="Close count-in"
      bottomInset={bottomInset}
      onDismiss={onDismiss}
    >
      <PickerGrid
        columns={4}
        accessibilityLabel="Count-in length"
        options={COUNT_IN_BAR_OPTIONS}
        selected={bars}
        onSelect={pickBars}
      />
      <SegmentedControl
        fill
        accessibilityLabel="Count-in sound"
        options={COUNT_IN_MODE_OPTIONS}
        selected={mode}
        onSelect={pickMode}
      />
    </Sheet>
  );
}
