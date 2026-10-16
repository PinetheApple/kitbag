import {
  EditGroup,
  EditRow,
  EditValue,
  SegmentedControl,
  type StepDelta,
} from '@kitbag/core-design';
import { KB_MUTE_BARS_BOUNDS } from '@kitbag/core-native';
import { BPM_BOUNDS, type PerAccentSounds } from '@kitbag/core-state';
import { useCallback, useState } from 'react';
import { Pressable } from 'react-native';

import {
  COUNT_IN_BAR_OPTIONS,
  countInBarsFromOption,
} from '../../logic/countIn.ts';
import type { BarMuteDraft, RampDraft } from '../../logic/presetDraft.ts';
import {
  RAMP_UNIT_OPTIONS,
  rampUnitFromOption,
  rampUnitLabel,
  rampUnitOption,
  stepRampDuration,
  withRampUnit,
} from '../../logic/rampUnit.ts';
import { soundChipLabel, soundLabel } from '../../logic/soundChoice.ts';
import { stepWithin } from '../../logic/trainer.ts';
import { SoundPickerSheet } from '../../screen/SoundSheet.tsx';
import { OnOff, TrainerStep } from './fields.tsx';
import type { PresetEditor } from './usePresetEditor.ts';

const stepFrom = (ramp: RampDraft, delta: StepDelta): RampDraft => ({
  ...ramp,
  startBpm: stepWithin(ramp.startBpm, delta, BPM_BOUNDS),
});
const stepTo = (ramp: RampDraft, delta: StepDelta): RampDraft => ({
  ...ramp,
  endBpm: stepWithin(ramp.endBpm, delta, BPM_BOUNDS),
});
const stepPlay = (mute: BarMuteDraft, delta: StepDelta): BarMuteDraft => ({
  ...mute,
  playBars: stepWithin(mute.playBars, delta, KB_MUTE_BARS_BOUNDS),
});
const stepMute = (mute: BarMuteDraft, delta: StepDelta): BarMuteDraft => ({
  ...mute,
  muteBars: stepWithin(mute.muteBars, delta, KB_MUTE_BARS_BOUNDS),
});

function SoundRow(props: {
  readonly editor: PresetEditor;
  readonly bottomInset: number;
}) {
  const { draft, update } = props.editor;
  const [open, setOpen] = useState(false);
  const show = useCallback(() => {
    setOpen(true);
  }, []);
  const hide = useCallback(() => {
    setOpen(false);
  }, []);
  const change = useCallback(
    (perAccentSounds: PerAccentSounds) => {
      update((d) => ({ ...d, sound: perAccentSounds.normal, perAccentSounds }));
    },
    [update],
  );
  const { normal, accent } = draft.perAccentSounds;
  return (
    <EditRow label="Sound">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Sounds, normal ${soundLabel(normal)}, accent ${soundLabel(accent)}`}
        onPress={show}
      >
        <EditValue>{soundChipLabel(draft.perAccentSounds)}</EditValue>
      </Pressable>
      <SoundPickerSheet
        visible={open}
        bottomInset={props.bottomInset}
        onDismiss={hide}
        sounds={draft.perAccentSounds}
        onChange={change}
      />
    </EditRow>
  );
}

function RampTempo({ editor }: { readonly editor: PresetEditor }) {
  const { draft, update } = editor;
  const common = { update, trainer: 'ramp' as const, unit: 'BPM' };
  return (
    <EditRow label="From / to">
      <TrainerStep
        {...common}
        label="Ramp from"
        value={draft.ramp.startBpm}
        step={stepFrom}
      />
      <TrainerStep
        {...common}
        label="Ramp to"
        value={draft.ramp.endBpm}
        step={stepTo}
      />
    </EditRow>
  );
}

function RampLength({ editor }: { readonly editor: PresetEditor }) {
  const { draft, update } = editor;
  const setUnit = useCallback(
    (option: string) => {
      update((d) => ({
        ...d,
        ramp: withRampUnit(d.ramp, rampUnitFromOption(option)),
      }));
    },
    [update],
  );
  return (
    <EditRow label="Over">
      <TrainerStep
        update={update}
        trainer="ramp"
        label="Ramp length"
        unit={rampUnitLabel(draft.ramp.unit)}
        value={draft.ramp.duration}
        step={stepRampDuration}
      />
      <SegmentedControl
        compact
        accessibilityLabel="Ramp length unit"
        options={RAMP_UNIT_OPTIONS}
        selected={rampUnitOption(draft.ramp.unit)}
        onSelect={setUnit}
      />
    </EditRow>
  );
}

function RampLoop({ editor }: { readonly editor: PresetEditor }) {
  const { draft, update } = editor;
  const toggle = useCallback(
    (loop: boolean) => {
      update((d) => ({ ...d, ramp: { ...d.ramp, loop } }));
    },
    [update],
  );
  return (
    <EditRow label="Loop back at end">
      <OnOff on={draft.ramp.loop} label="Loop back at end" onChange={toggle} />
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
      {draft.ramp.enabled ? (
        <>
          <RampTempo editor={editor} />
          <RampLength editor={editor} />
          <RampLoop editor={editor} />
        </>
      ) : null}
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
  const common = { update, trainer: 'barMute' as const, unit: 'bars' };
  return (
    <>
      <EditRow label="Mute bars">
        <OnOff on={draft.barMute.enabled} label="Mute bars" onChange={toggle} />
      </EditRow>
      {draft.barMute.enabled ? (
        <EditRow label="Play / mute">
          <TrainerStep
            {...common}
            label="Bars to play"
            value={draft.barMute.playBars}
            step={stepPlay}
          />
          <TrainerStep
            {...common}
            label="Bars to mute"
            value={draft.barMute.muteBars}
            step={stepMute}
          />
        </EditRow>
      ) : null}
    </>
  );
}

function CountInRow({ editor }: { readonly editor: PresetEditor }) {
  const { update } = editor;
  const setCountIn = useCallback(
    (value: string) => {
      update((d) => ({ ...d, countInBars: countInBarsFromOption(value) }));
    },
    [update],
  );
  return (
    <EditRow label="Count-in">
      <SegmentedControl
        compact
        accessibilityLabel="Count-in"
        options={COUNT_IN_BAR_OPTIONS}
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
