import { useCallback, useState } from 'react';

import type { PerAccentSounds } from '../metronome/store.ts';
import { useHoldEngine } from '../metronome/useHoldEngine.ts';
import { useMetronome } from '../metronome/useMetronome.ts';
import { SOUND_ROLE, soundsWith, type SoundRole } from './soundChoice.ts';

export type SoundsUpdate = (sounds: PerAccentSounds) => PerAccentSounds;

export interface SoundPicker {
  readonly role: SoundRole;
  readonly setRole: (role: SoundRole) => void;
  readonly pick: (id: number) => void;
}

export function useSoundPicker(
  visible: boolean,
  onChange: (update: SoundsUpdate) => void,
): SoundPicker {
  useHoldEngine(visible);
  const [role, setRole] = useState<SoundRole>(SOUND_ROLE.normal);
  const previewSound = useMetronome((state) => state.previewSound);
  const pick = useCallback(
    (id: number) => {
      onChange((current) => soundsWith(current, role, id));
      previewSound(id, role === SOUND_ROLE.accent);
    },
    [onChange, previewSound, role],
  );
  return { role, setRole, pick };
}
