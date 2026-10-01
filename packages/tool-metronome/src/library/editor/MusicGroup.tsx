import {
  EditGroup,
  EditRow,
  EditTextInput,
  StepControl,
  type StepDelta,
} from '@kitbag/core-design';
import { KB_STOPPED_BEAT } from '@kitbag/core-native';
import { BPM_BOUNDS } from '@kitbag/core-state';
import { useCallback } from 'react';
import { useSharedValue } from 'react-native-reanimated';

import {
  withBeats,
  withCycledAccent,
  withNextDenominator,
  withPolyBeats,
} from '../../logic/presetDraft.ts';
import { subdivisionGlyph } from '../../logic/subdivision.ts';
import { BeatLeds } from '../../screen/BeatLeds.tsx';
import { OnOff, StepField } from './fields.tsx';
import type { PresetEditor } from './usePresetEditor.ts';

const SUBDIVISION_MAX = 16;

function useIdentitySetters(editor: PresetEditor) {
  const { update } = editor;
  const setName = useCallback(
    (name: string) => {
      update((d) => ({ ...d, name }));
    },
    [update],
  );
  const setNotes = useCallback(
    (notes: string) => {
      update((d) => ({ ...d, notes }));
    },
    [update],
  );
  return { setName, setNotes };
}

export function IdentityGroup({ editor }: { readonly editor: PresetEditor }) {
  const { setName, setNotes } = useIdentitySetters(editor);
  const { draft } = editor;
  return (
    <EditGroup>
      <EditRow label="Name">
        <EditTextInput
          value={draft.name}
          onChangeText={setName}
          placeholder="Song name"
          accessibilityLabel="Name"
        />
      </EditRow>
      <EditRow label="Notes">
        <EditTextInput
          value={draft.notes}
          onChangeText={setNotes}
          placeholder="Add a note"
          accessibilityLabel="Notes"
        />
      </EditRow>
    </EditGroup>
  );
}

function SignatureRow({ editor }: { readonly editor: PresetEditor }) {
  const { draft, update } = editor;
  const step = useCallback(
    (delta: StepDelta) => {
      update((d) => withBeats(d, delta));
    },
    [update],
  );
  const cycle = useCallback(() => {
    update(withNextDenominator);
  }, [update]);
  const value = `${String(draft.beatsPerBar)}/${String(draft.denominator)}`;
  return (
    <EditRow label="Time signature">
      <StepControl
        variant="inline"
        label="Time signature"
        value={value}
        onStep={step}
        onValuePress={cycle}
      />
    </EditRow>
  );
}

function AccentsRow({ editor }: { readonly editor: PresetEditor }) {
  const { draft, update } = editor;
  const idle = useSharedValue(KB_STOPPED_BEAT);
  const cycle = useCallback(
    (beat: number) => {
      update((d) => withCycledAccent(d, beat));
    },
    [update],
  );
  return (
    <EditRow label="Accents">
      <BeatLeds
        size="small"
        beatCount={draft.beatsPerBar}
        accents={draft.accents}
        currentBeat={idle}
        onCycle={cycle}
      />
    </EditRow>
  );
}

function PolyRow({ editor }: { readonly editor: PresetEditor }) {
  const { draft, update } = editor;
  const toggle = useCallback(
    (polyEnabled: boolean) => {
      update((d) => ({ ...d, polyEnabled }));
    },
    [update],
  );
  const step = useCallback(
    (delta: StepDelta) => {
      update((d) => withPolyBeats(d, delta));
    },
    [update],
  );
  return (
    <>
      <EditRow label="Polyrhythm">
        {draft.polyEnabled ? (
          <StepControl
            variant="inline"
            label="Polyrhythm beats"
            value={`${String(draft.polyBeats)}:${String(draft.beatsPerBar)}`}
            accessibilityValue={`${String(draft.polyBeats)} beats`}
            onStep={step}
          />
        ) : null}
        <OnOff on={draft.polyEnabled} label="Polyrhythm" onChange={toggle} />
      </EditRow>
    </>
  );
}

function TempoRow({ editor }: { readonly editor: PresetEditor }) {
  return (
    <EditRow label="Tempo">
      <StepField
        update={editor.update}
        field="bpm"
        value={editor.draft.bpm}
        label="Tempo"
        unit="BPM"
        min={BPM_BOUNDS.min}
        max={BPM_BOUNDS.max}
      />
    </EditRow>
  );
}

function SubdivisionRow({ editor }: { readonly editor: PresetEditor }) {
  const value = editor.draft.subdivision;
  return (
    <EditRow label="Subdivision">
      <StepField
        update={editor.update}
        field="subdivision"
        value={value}
        display={subdivisionGlyph(value)}
        label="Subdivision"
        unit="per beat"
        min={1}
        max={SUBDIVISION_MAX}
      />
    </EditRow>
  );
}

export function MusicGroup({ editor }: { readonly editor: PresetEditor }) {
  return (
    <EditGroup>
      <TempoRow editor={editor} />
      <SignatureRow editor={editor} />
      <SubdivisionRow editor={editor} />
      <AccentsRow editor={editor} />
      <PolyRow editor={editor} />
    </EditGroup>
  );
}
