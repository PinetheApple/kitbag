import {
  PickerGrid,
  SegmentedControl,
  Sheet,
  SHEET_TOUCH_ROOM,
  space,
  unshared,
} from '@kitbag/core-design';
import {
  useMetronome,
  withoutSound,
  type PerAccentSounds,
  SOUND_OPTIONS,
  SOUND_ROLE,
  SOUND_ROLE_OPTIONS,
  soundPickerLabel,
  soundsWith,
  type SoundRole,
} from '@kitbag/core-state';
import { useCallback, useState } from 'react';

import { CustomSoundSheets, useCustomSoundMenu } from './CustomSoundSheets.tsx';
import { CustomSounds, useImportHint } from './CustomSounds.tsx';
import { useHoldEngine } from './useHoldEngine.ts';

// Heads the sheet; the picker grid below does not reach into the gap.
const ROLE_GAPS = {
  top: unshared(SHEET_TOUCH_ROOM),
  bottom: unshared(space.sectionGap),
};

const PICKER_HINT =
  'Tap a sound to hear it at the current volume. Accent and normal beats can use different sounds.';

interface SoundSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

export interface SoundPickerSheetProps extends SoundSheetProps {
  readonly sounds: PerAccentSounds;
  readonly onChange: (
    update: (sounds: PerAccentSounds) => PerAccentSounds,
  ) => void;
}

export function SoundPickerSheet({
  visible,
  bottomInset,
  onDismiss,
  sounds,
  onChange,
}: SoundPickerSheetProps) {
  useHoldEngine(visible);
  const [role, setRole] = useState<SoundRole>(SOUND_ROLE.normal);
  const previewSound = useMetronome((state) => state.previewSound);
  const importHint = useImportHint();
  const menu = useCustomSoundMenu();
  const pick = useCallback(
    (id: number) => {
      onChange((current) => soundsWith(current, role, id));
      previewSound(id, role === SOUND_ROLE.accent);
    },
    [onChange, previewSound, role],
  );
  const pickOption = useCallback(
    (value: string) => {
      pick(Number(value));
    },
    [pick],
  );
  const handleRemoved = useCallback(
    (id: number) => {
      onChange((current) => withoutSound(current, id));
    },
    [onChange],
  );
  return (
    <>
      <Sheet
        visible={visible}
        title="Click sound"
        titleIcon="sound"
        hint={`${PICKER_HINT} ${importHint}`}
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
          accessibilityLabel={soundPickerLabel(role)}
          options={SOUND_OPTIONS}
          selected={String(sounds[role])}
          onSelect={pickOption}
        />
        <CustomSounds
          selected={sounds[role]}
          showHint={false}
          onPick={pick}
          onImported={pick}
          onOptions={menu.open}
        />
      </Sheet>
      <CustomSoundSheets
        menu={menu}
        bottomInset={bottomInset}
        sounds={sounds}
        onRemoved={handleRemoved}
      />
    </>
  );
}
