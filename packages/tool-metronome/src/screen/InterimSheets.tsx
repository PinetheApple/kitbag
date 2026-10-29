import {
  SegmentedControl,
  Sheet,
  space,
  StepControl,
  type StepDelta,
} from '@kitbag/core-design';
import { KB_DENOMINATORS } from '@kitbag/core-native';
import { useMetronome } from '@kitbag/core-state';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { subdivisionName } from '../logic/subdivision.ts';
import { TrainerChips } from './TrainerChips.tsx';

// Stand-ins until the layout B sheets land (#175 part 2): every control the
// old card held stays reachable from the chip or key that will own it.

const POLY = 'poly';
const POLY_OPTIONS = [{ value: POLY, label: POLY }] as const;
const CHIP_GAPS = { top: space.sectionGap, bottom: space.sectionGap };

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.rowGap,
  },
});

interface InterimSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

export function MeterStepSheet({
  visible,
  bottomInset,
  onDismiss,
}: InterimSheetProps) {
  const beatsPerBar = useMetronome((s) => s.beatsPerBar);
  const denominator = useMetronome((s) => s.denominator);
  const setBeats = useMetronome((s) => s.setBeats);
  const handleStep = useCallback(
    (delta: StepDelta) => {
      setBeats(beatsPerBar + delta, denominator);
    },
    [beatsPerBar, denominator, setBeats],
  );
  const handleDenominator = useCallback(() => {
    const next =
      KB_DENOMINATORS[
        (KB_DENOMINATORS.indexOf(denominator) + 1) % KB_DENOMINATORS.length
      ];
    if (next !== undefined) setBeats(beatsPerBar, next);
  }, [beatsPerBar, denominator, setBeats]);
  return (
    <Sheet
      visible={visible}
      title="Time signature"
      hint="Tap the value to change the note value."
      dismissLabel="Close time signature"
      bottomInset={bottomInset}
      onDismiss={onDismiss}
    >
      <StepControl
        label="Time signature"
        value={`${String(beatsPerBar)}/${String(denominator)}`}
        onStep={handleStep}
        onValuePress={handleDenominator}
      />
    </Sheet>
  );
}

export function SubdivisionStepSheet({
  visible,
  bottomInset,
  onDismiss,
}: InterimSheetProps) {
  const subdivision = useMetronome((s) => s.subdivision);
  const setSubdivision = useMetronome((s) => s.setSubdivision);
  const handleStep = useCallback(
    (delta: StepDelta) => {
      setSubdivision(subdivision + delta);
    },
    [subdivision, setSubdivision],
  );
  return (
    <Sheet
      visible={visible}
      title="Subdivision"
      dismissLabel="Close subdivision"
      bottomInset={bottomInset}
      onDismiss={onDismiss}
    >
      <StepControl
        label="Subdivision"
        value={subdivisionName(subdivision)}
        accessibilityValue={String(subdivision)}
        onStep={handleStep}
      />
    </Sheet>
  );
}

function PolyRow() {
  const beatsPerBar = useMetronome((s) => s.beatsPerBar);
  const polyEnabled = useMetronome((s) => s.polyEnabled);
  const polyBeats = useMetronome((s) => s.polyBeats);
  const setPoly = useMetronome((s) => s.setPoly);
  const handleStep = useCallback(
    (delta: StepDelta) => {
      setPoly(polyEnabled, polyBeats + delta);
    },
    [polyEnabled, polyBeats, setPoly],
  );
  const handleToggle = useCallback(() => {
    setPoly(!polyEnabled, polyBeats);
  }, [polyEnabled, polyBeats, setPoly]);
  return (
    <View style={styles.row}>
      <StepControl
        accented={polyEnabled}
        label="Polyrhythm"
        value={`${String(polyBeats)}:${String(beatsPerBar)}`}
        onStep={handleStep}
      />
      <SegmentedControl
        accessibilityLabel="Polyrhythm"
        options={POLY_OPTIONS}
        selected={polyEnabled ? POLY : undefined}
        selectedTone="accent"
        onSelect={handleToggle}
      />
    </View>
  );
}

export function PracticeToolsSheet({
  visible,
  bottomInset,
  onDismiss,
}: InterimSheetProps) {
  return (
    <Sheet
      visible={visible}
      title="Practice"
      titleIcon="practiceTools"
      dismissLabel="Close practice tools"
      bottomInset={bottomInset}
      onDismiss={onDismiss}
    >
      <TrainerChips bottomInset={bottomInset} neighbourGapDp={CHIP_GAPS} />
      <PolyRow />
    </Sheet>
  );
}
