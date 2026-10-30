import { Sheet } from '@kitbag/core-design';
import { useMetronome } from '@kitbag/core-state';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  practiceEntry,
  withPracticeEntry,
  type PracticeField,
  type PracticeValues,
} from '../logic/practiceEntry.ts';
import type { SoundRole } from '../logic/soundChoice.ts';
import { NumberEntrySheet } from './NumberEntrySheet.tsx';
import { PracticeRamp } from './PracticeRamp.tsx';
import {
  PracticeCountIn,
  PracticeMute,
  PracticePoly,
} from './PracticeSections.tsx';
import { PracticeSound, SoundListSheet } from './PracticeSound.tsx';

interface PracticeSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

function usePracticeValues(): PracticeValues {
  const ramp = useMetronome((s) => s.ramp);
  const barMute = useMetronome((s) => s.barMute);
  const polyBeats = useMetronome((s) => s.polyBeats);
  const beatsPerBar = useMetronome((s) => s.beatsPerBar);
  return useMemo(
    () => ({ ramp, barMute, polyBeats, beatsPerBar }),
    [ramp, barMute, polyBeats, beatsPerBar],
  );
}

function PracticeNumpad({
  field,
  bottomInset,
  onDismiss,
}: {
  readonly field: PracticeField | null;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}) {
  const values = usePracticeValues();
  const setRamp = useMetronome((s) => s.setRamp);
  const setBarMute = useMetronome((s) => s.setBarMute);
  const setPoly = useMetronome((s) => s.setPoly);
  const polyEnabled = useMetronome((s) => s.polyEnabled);
  const shown = field ?? 'startBpm';
  const entry = practiceEntry(shown, values);
  const handleConfirm = useCallback(
    (typed: number) => {
      const next = withPracticeEntry(values, shown, typed);
      if (next.ramp !== values.ramp) setRamp(next.ramp);
      if (next.barMute !== values.barMute) setBarMute(next.barMute);
      if (next.polyBeats !== values.polyBeats) {
        setPoly(polyEnabled, next.polyBeats);
      }
    },
    [values, shown, setRamp, setBarMute, setPoly, polyEnabled],
  );
  return (
    <NumberEntrySheet
      visible={field !== null}
      title={entry.title}
      confirmLabel={entry.confirm}
      value={entry.value}
      bounds={entry.bounds}
      unit={entry.unit}
      bottomInset={bottomInset}
      onConfirm={handleConfirm}
      onDismiss={onDismiss}
    />
  );
}

export function PracticeSheet({
  visible,
  bottomInset,
  onDismiss,
}: PracticeSheetProps) {
  const [numpadField, setNumpadField] = useState<PracticeField | null>(null);
  const [soundRole, setSoundRole] = useState<SoundRole | null>(null);
  const handleCloseNumpad = useCallback(() => {
    setNumpadField(null);
  }, []);
  const handleCloseSounds = useCallback(() => {
    setSoundRole(null);
  }, []);
  return (
    <>
      <Sheet
        visible={visible}
        title="Practice"
        dismissLabel="Close practice tools"
        bottomInset={bottomInset}
        dim
        onDismiss={onDismiss}
      >
        <View>
          <PracticeRamp onType={setNumpadField} />
          <PracticeMute onType={setNumpadField} />
          <PracticeCountIn />
          <PracticeSound onOpen={setSoundRole} />
          <PracticePoly onType={setNumpadField} />
        </View>
      </Sheet>
      <PracticeNumpad
        field={numpadField}
        bottomInset={bottomInset}
        onDismiss={handleCloseNumpad}
      />
      <SoundListSheet
        role={soundRole}
        bottomInset={bottomInset}
        onDismiss={handleCloseSounds}
      />
    </>
  );
}
