import { SoundPickerSheet } from '@kitbag/core-design';
import {
  getPlayAlongStore,
  SOUND_OPTIONS,
  SOUND_PICKER_HINT,
  SOUND_ROLE_OPTIONS,
  soundPickerLabel,
  useMetronome,
  useSoundPicker,
  type SoundsUpdate,
} from '@kitbag/core-state';

import { usePlayAlong } from './playAlongHooks.ts';

export interface ClickSoundSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

export function changePlayAlongSounds(update: SoundsUpdate): void {
  const { pattern, setSounds } = getPlayAlongStore().getState();
  const { normal, accent } = update(pattern.sounds);
  setSounds(normal, accent);
}

export function ClickSoundSheet({
  visible,
  bottomInset,
  onDismiss,
}: ClickSoundSheetProps) {
  const sounds = usePlayAlong((s) => s.pattern.sounds);
  const preview = useMetronome((s) => s.previewSelectedSlot);
  const { role, setRole, pick } = useSoundPicker(
    visible,
    changePlayAlongSounds,
    preview,
  );
  return (
    <SoundPickerSheet
      visible={visible}
      bottomInset={bottomInset}
      hint={SOUND_PICKER_HINT}
      roles={SOUND_ROLE_OPTIONS}
      role={role}
      gridLabel={soundPickerLabel(role)}
      options={SOUND_OPTIONS}
      selected={String(sounds[role])}
      onRole={setRole}
      onPick={pick}
      onDismiss={onDismiss}
    />
  );
}
