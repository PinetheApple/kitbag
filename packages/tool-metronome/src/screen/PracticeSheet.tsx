import { Sheet } from '@kitbag/core-design';
import { useMetronome } from '@kitbag/core-state';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { RAMP_BPM_ENTRY, type RampBpmField } from '../logic/rampEntry.ts';
import type { SoundRole } from '../logic/soundChoice.ts';
import { BpmNumpadSheet } from './BpmNumpadSheet.tsx';
import { PracticeRamp } from './PracticeRamp.tsx';
import {
  PracticeCountIn,
  PracticeMute,
  PracticePoly,
} from './PracticeSections.tsx';
import { PracticeSound, SoundListSheet } from './PracticeSound.tsx';
import { useRampEditor } from './useRampEditor.ts';

interface PracticeSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

function RampNumpad({
  field,
  bottomInset,
  onDismiss,
}: {
  readonly field: RampBpmField | null;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}) {
  const ramp = useMetronome((s) => s.ramp);
  const { typeBpm } = useRampEditor();
  const shown = field ?? 'startBpm';
  const handleConfirm = useCallback(
    (bpm: number) => {
      typeBpm(shown, bpm);
    },
    [typeBpm, shown],
  );
  return (
    <BpmNumpadSheet
      visible={field !== null}
      title={RAMP_BPM_ENTRY[shown].title}
      confirmLabel={RAMP_BPM_ENTRY[shown].confirm}
      bpm={ramp[shown]}
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
  const [numpadField, setNumpadField] = useState<RampBpmField | null>(null);
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
        onDismiss={onDismiss}
      >
        <View>
          <PracticeRamp onTypeBpm={setNumpadField} />
          <PracticeMute />
          <PracticeCountIn />
          <PracticeSound onOpen={setSoundRole} />
          <PracticePoly />
        </View>
      </Sheet>
      <RampNumpad
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
