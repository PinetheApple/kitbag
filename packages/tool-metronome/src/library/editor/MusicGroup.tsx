import {
  countLabel,
  EditDivider,
  EditGroup,
  EditRow,
  EditTextInput,
  metronomeEditor,
  space,
  StepControl,
  type StepDelta,
} from '@kitbag/core-design';
import { KB_STOPPED_BEAT, KB_SUBDIVISION_BOUNDS } from '@kitbag/core-native';
import { BPM_BOUNDS } from '@kitbag/core-state';
import { useCallback } from 'react';
import { View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import {
  withBeats,
  withCycledAccent,
  withNextDenominator,
  withPolyAgainst,
  withPolyBeats,
} from '../../logic/presetDraft.ts';
import { polyAgainstLabel } from '../../logic/polyRow.ts';
import { subdivisionLabel } from '../../logic/subdivision.ts';
import { BeatLeds } from '../../screen/BeatLeds.tsx';

const SUB_ROW = {
  paddingLeft: metronomeEditor.subRowIndent,
  minHeight: metronomeEditor.subRowMin,
  justifyContent: 'center',
} as const;

const EDITOR_LED_GAPS = {
  top: space.rowGap,
  bottom: space.rowGap,
  left: space.rowGap,
};
import { OnOff, StepField } from './fields.tsx';
import type { PresetEditor } from './usePresetEditor.ts';

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
        neighbourGapDp={EDITOR_LED_GAPS}
      />
    </EditRow>
  );
}

function PolyRows({ editor }: { readonly editor: PresetEditor }) {
  const { draft, update } = editor;
  const toggle = useCallback(
    (polyEnabled: boolean) => {
      update((d) => ({ ...d, polyEnabled }));
    },
    [update],
  );
  const stepPoly = useCallback(
    (delta: StepDelta) => {
      update((d) => withPolyBeats(d, delta));
    },
    [update],
  );
  const stepAgainst = useCallback(
    (delta: StepDelta) => {
      update((d) => withPolyAgainst(d, delta));
    },
    [update],
  );
  const against = polyAgainstLabel(draft.polyAgainst, draft.beatsPerBar);
  return (
    <>
      <EditRow label="Polyrhythm">
        <OnOff on={draft.polyEnabled} label="Polyrhythm" onChange={toggle} />
      </EditRow>
      {draft.polyEnabled ? (
        <>
          <EditDivider />
          <View style={SUB_ROW}>
            <EditRow label="Poly">
              <StepControl
                variant="inlineLarge"
                label="Poly"
                value={String(draft.polyBeats)}
                accessibilityValue={countLabel(
                  draft.polyBeats,
                  'beat',
                  'beats',
                )}
                onStep={stepPoly}
              />
            </EditRow>
          </View>
          <EditDivider />
          <View style={SUB_ROW}>
            <EditRow label="Against">
              <StepControl
                variant="inlineLarge"
                label="Against"
                value={against.value}
                suffix={against.suffix}
                onStep={stepAgainst}
              />
            </EditRow>
          </View>
        </>
      ) : null}
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
        display={subdivisionLabel(value)}
        label="Subdivision"
        unit="per beat"
        min={KB_SUBDIVISION_BOUNDS.min}
        max={KB_SUBDIVISION_BOUNDS.max}
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
      <PolyRows editor={editor} />
    </EditGroup>
  );
}
