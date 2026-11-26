import { SoundPickerSheet } from '@kitbag/core-design';
import {
  withoutSound,
  type PerAccentSounds,
  SOUND_OPTIONS,
  SOUND_PICKER_HINT,
  SOUND_ROLE_OPTIONS,
  soundPickerLabel,
  type SoundsUpdate,
  useSoundPicker,
} from '@kitbag/core-state';
import { useCallback } from 'react';

import { CustomSoundSheets, useCustomSoundMenu } from './CustomSoundSheets.tsx';
import { CustomSounds, useImportHint } from './CustomSounds.tsx';

export interface MetronomeSoundSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
  readonly sounds: PerAccentSounds;
  readonly onChange: (update: SoundsUpdate) => void;
}

export function MetronomeSoundSheet({
  visible,
  bottomInset,
  onDismiss,
  sounds,
  onChange,
}: MetronomeSoundSheetProps) {
  const { role, setRole, pick } = useSoundPicker(visible, onChange);
  const importHint = useImportHint();
  const menu = useCustomSoundMenu();
  const handleRemoved = useCallback(
    (id: number) => {
      onChange((current) => withoutSound(current, id));
    },
    [onChange],
  );
  return (
    <>
      <SoundPickerSheet
        visible={visible}
        bottomInset={bottomInset}
        hint={`${SOUND_PICKER_HINT} ${importHint}`}
        roles={SOUND_ROLE_OPTIONS}
        role={role}
        gridLabel={soundPickerLabel(role)}
        options={SOUND_OPTIONS}
        selected={String(sounds[role])}
        onRole={setRole}
        onPick={pick}
        onDismiss={onDismiss}
      >
        <CustomSounds
          selected={sounds[role]}
          showHint={false}
          onPick={pick}
          onImported={pick}
          onOptions={menu.open}
        />
      </SoundPickerSheet>
      <CustomSoundSheets
        menu={menu}
        bottomInset={bottomInset}
        sounds={sounds}
        onRemoved={handleRemoved}
      />
    </>
  );
}
