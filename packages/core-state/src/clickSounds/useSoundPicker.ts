import { useCallback, useState } from 'react';

import type { PerAccentSounds } from '../metronome/store.ts';
import { useHoldEngine } from '../metronome/useHoldEngine.ts';
import { SOUND_ROLE, soundsWith, type SoundRole } from './soundChoice.ts';

export type SoundsUpdate = (sounds: PerAccentSounds) => PerAccentSounds;

export type SoundPreview = (sound: number, accented: boolean) => void;

export interface SoundPicker {
  readonly role: SoundRole;
  readonly setRole: (role: SoundRole) => void;
  readonly pick: (id: number) => void;
}

export function useSoundPicker(
  visible: boolean,
  onChange: (update: SoundsUpdate) => void,
  preview: SoundPreview,
): SoundPicker {
  useHoldEngine(visible);
  const [role, setRole] = useState<SoundRole>(SOUND_ROLE.normal);
  const pick = useCallback(
    (id: number) => {
      onChange((current) => soundsWith(current, role, id));
      preview(id, role === SOUND_ROLE.accent);
    },
    [onChange, preview, role],
  );
  return { role, setRole, pick };
}
