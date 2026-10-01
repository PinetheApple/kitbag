import { PickerGrid, SegmentedControl, Sheet } from '@kitbag/core-design';
import { useMetronome } from '@kitbag/core-state';
import { useCallback, useState } from 'react';

import {
  SOUND_OPTIONS,
  SOUND_ROLE,
  SOUND_ROLE_OPTIONS,
  soundsWith,
  type SoundRole,
} from '../logic/soundChoice.ts';

interface SoundSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

function useSoundPick(role: SoundRole) {
  const sounds = useMetronome((state) => state.sounds);
  const setSounds = useMetronome((state) => state.setSounds);
  const previewSound = useMetronome((state) => state.previewSound);
  const pick = useCallback(
    (value: string) => {
      const next = soundsWith(sounds, role, Number(value));
      setSounds(next.normal, next.accent);
      previewSound(Number(value), role === SOUND_ROLE.accent);
    },
    [previewSound, role, setSounds, sounds],
  );
  return { selected: String(sounds[role]), pick };
}

export function SoundSheet({
  visible,
  bottomInset,
  onDismiss,
}: SoundSheetProps) {
  const [role, setRole] = useState<SoundRole>(SOUND_ROLE.normal);
  const { selected, pick } = useSoundPick(role);
  return (
    <Sheet
      visible={visible}
      title="Click sound"
      titleIcon="sound"
      hint="Tap a sound to hear it at the current volume. Accent and normal beats can use different sounds."
      dismissLabel="Close click sound"
      bottomInset={bottomInset}
      onDismiss={onDismiss}
    >
      <SegmentedControl
        fill
        accessibilityLabel="Beat level"
        options={SOUND_ROLE_OPTIONS}
        selected={role}
        onSelect={setRole}
      />
      <PickerGrid
        accessibilityLabel={`${role} beat sound`}
        options={SOUND_OPTIONS}
        selected={selected}
        onSelect={pick}
      />
    </Sheet>
  );
}
