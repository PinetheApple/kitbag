import {
  EditGroup,
  EditRow,
  EditValue,
  PickerGrid,
  SegmentedControl,
  Sheet,
  type SegmentOption,
} from '@kitbag/core-design';
import {
  KB_MAX_MUTE_BARS,
  KB_MAX_RAMP_BARS,
  KB_SOUND_NAMES,
} from '@kitbag/core-native';
import { BPM_BOUNDS } from '@kitbag/core-state';
import { useCallback, useState } from 'react';
import { Pressable } from 'react-native';

import { soundLabel } from '../../logic/songSummary.ts';
import { OnOff, TrainerStep } from './fields.tsx';
import type { PresetEditor } from './usePresetEditor.ts';

type SoundLevel = 'normal' | 'accent';
const SOUND_LEVELS: readonly SegmentOption<SoundLevel>[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'accent', label: 'Accent' },
];
const SOUND_COLUMNS = 3;
const SOUNDS: readonly SegmentOption<string>[] = KB_SOUND_NAMES.map(
  (_n, i) => ({ value: String(i), label: soundLabel(i) }),
);
const COUNT_IN: readonly SegmentOption<string>[] = [
  { value: '0', label: 'Off' },
  { value: '1', label: '1', accessibilityLabel: '1 bar' },
  { value: '2', label: '2', accessibilityLabel: '2 bars' },
  { value: '4', label: '4', accessibilityLabel: '4 bars' },
];

function useSoundPicker(editor: PresetEditor) {
  const { update } = editor;
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<SoundLevel>('normal');
  const show = useCallback(() => {
    setOpen(true);
  }, []);
  const hide = useCallback(() => {
    setOpen(false);
  }, []);
  const pick = useCallback(
    (value: string) => {
      const sound = Number(value);
      update((draft) => ({
        ...draft,
        sound: level === 'normal' ? sound : draft.sound,
        perAccentSounds: { ...draft.perAccentSounds, [level]: sound },
      }));
    },
    [level, update],
  );
  return { open, level, show, hide, pick, setLevel };
}

function SoundSheet({
  editor,
  bottomInset,
  picker,
}: {
  readonly editor: PresetEditor;
  readonly bottomInset: number;
  readonly picker: ReturnType<typeof useSoundPicker>;
}) {
  return (
    <Sheet
      visible={picker.open}
      title="Click sound"
      titleIcon="sound"
      dismissLabel="Close click sound"
      bottomInset={bottomInset}
      onDismiss={picker.hide}
    >
      <SegmentedControl
        fill
        accessibilityLabel="Accent level"
        options={SOUND_LEVELS}
        selected={picker.level}
        onSelect={picker.setLevel}
      />
      <PickerGrid
        accessibilityLabel={`${picker.level} click sound`}
        columns={SOUND_COLUMNS}
        options={SOUNDS}
        selected={String(editor.draft.perAccentSounds[picker.level])}
        onSelect={picker.pick}
      />
    </Sheet>
  );
}

function SoundRow(props: {
  readonly editor: PresetEditor;
  readonly bottomInset: number;
}) {
  const picker = useSoundPicker(props.editor);
  const normal = soundLabel(props.editor.draft.perAccentSounds.normal);
  const accent = soundLabel(props.editor.draft.perAccentSounds.accent);
  const label = normal === accent ? normal : `${normal} / ${accent}`;
  return (
    <EditRow label="Sound">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Sounds, normal ${normal}, accent ${accent}`}
        onPress={picker.show}
      >
        <EditValue>{label}</EditValue>
      </Pressable>
      <SoundSheet {...props} picker={picker} />
    </EditRow>
  );
}

function RampSteps({ editor }: { readonly editor: PresetEditor }) {
  const common = {
    update: editor.update,
    draft: editor.draft,
    trainer: 'ramp' as const,
  };
  const bpm = {
    ...common,
    unit: 'BPM',
    min: BPM_BOUNDS.min,
    max: BPM_BOUNDS.max,
  };
  return (
    <EditRow label="From / to / over">
      <TrainerStep {...bpm} part="a" label="Ramp from" />
      <TrainerStep {...bpm} part="b" label="Ramp to" />
      <TrainerStep
        {...common}
        part="bars"
        label="Ramp length"
        unit="bars"
        min={1}
        max={KB_MAX_RAMP_BARS}
      />
    </EditRow>
  );
}

function RampRows({ editor }: { readonly editor: PresetEditor }) {
  const { draft, update } = editor;
  const toggle = useCallback(
    (enabled: boolean) => {
      update((d) => ({ ...d, ramp: { ...d.ramp, enabled } }));
    },
    [update],
  );
  return (
    <>
      <EditRow label="Tempo ramp">
        <OnOff on={draft.ramp.enabled} label="Tempo ramp" onChange={toggle} />
      </EditRow>
      {draft.ramp.enabled ? <RampSteps editor={editor} /> : null}
    </>
  );
}

function MuteRows({ editor }: { readonly editor: PresetEditor }) {
  const { draft, update } = editor;
  const toggle = useCallback(
    (enabled: boolean) => {
      update((d) => ({ ...d, barMute: { ...d.barMute, enabled } }));
    },
    [update],
  );
  const common = {
    update,
    draft,
    trainer: 'barMute' as const,
    unit: 'bars',
    min: 1,
    max: KB_MAX_MUTE_BARS,
  };
  return (
    <>
      <EditRow label="Mute bars">
        <OnOff on={draft.barMute.enabled} label="Mute bars" onChange={toggle} />
      </EditRow>
      {draft.barMute.enabled ? (
        <EditRow label="Play / mute">
          <TrainerStep {...common} part="a" label="Bars to play" />
          <TrainerStep {...common} part="b" label="Bars to mute" />
        </EditRow>
      ) : null}
    </>
  );
}

function CountInRow({ editor }: { readonly editor: PresetEditor }) {
  const { update } = editor;
  const setCountIn = useCallback(
    (value: string) => {
      update((d) => ({ ...d, countInBars: Number(value) }));
    },
    [update],
  );
  return (
    <EditRow label="Count-in">
      <SegmentedControl
        compact
        accessibilityLabel="Count-in"
        options={COUNT_IN}
        selected={String(editor.draft.countInBars)}
        onSelect={setCountIn}
      />
    </EditRow>
  );
}

export function RigGroup({
  editor,
  bottomInset,
}: {
  readonly editor: PresetEditor;
  readonly bottomInset: number;
}) {
  return (
    <EditGroup>
      <SoundRow editor={editor} bottomInset={bottomInset} />
      <CountInRow editor={editor} />
      <RampRows editor={editor} />
      <MuteRows editor={editor} />
    </EditGroup>
  );
}
