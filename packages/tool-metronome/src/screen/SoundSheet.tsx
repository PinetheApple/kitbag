import {
  PickerGrid,
  SegmentedControl,
  Sheet,
  SHEET_TOUCH_ROOM,
  space,
  unshared,
} from '@kitbag/core-design';
import { useMetronome, type PerAccentSounds } from '@kitbag/core-state';
import { useCallback, useState } from 'react';

import {
  SOUND_OPTIONS,
  SOUND_ROLE,
  SOUND_ROLE_OPTIONS,
  soundsWith,
  type SoundRole,
} from '../logic/soundChoice.ts';

// Heads the sheet; the picker grid below does not reach into the gap.
const ROLE_GAPS = {
  top: unshared(SHEET_TOUCH_ROOM),
  bottom: unshared(space.sectionGap),
};

interface SoundSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

export interface SoundPickerSheetProps extends SoundSheetProps {
  readonly sounds: PerAccentSounds;
  readonly onChange: (sounds: PerAccentSounds) => void;
}

export function SoundPickerSheet({
  visible,
  bottomInset,
  onDismiss,
  sounds,
  onChange,
}: SoundPickerSheetProps) {
  const [role, setRole] = useState<SoundRole>(SOUND_ROLE.normal);
  const previewSound = useMetronome((state) => state.previewSound);
  const pick = useCallback(
    (value: string) => {
      onChange(soundsWith(sounds, role, Number(value)));
      previewSound(Number(value), role === SOUND_ROLE.accent);
    },
    [onChange, previewSound, role, sounds],
  );
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
        neighbourGapDp={ROLE_GAPS}
        onSelect={setRole}
      />
      <PickerGrid
        accessibilityLabel={`${role} beat sound`}
        options={SOUND_OPTIONS}
        selected={String(sounds[role])}
        onSelect={pick}
      />
    </Sheet>
  );
}
