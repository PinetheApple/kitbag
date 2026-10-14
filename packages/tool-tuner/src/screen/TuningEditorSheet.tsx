import {
  Button,
  createThemedStyles,
  inset,
  radius,
  SegmentedControl,
  Sheet,
  SheetHint,
  size,
  space,
  StepControl,
  textRoles,
  textStyle,
  useTheme,
  type StepDelta,
} from '@kitbag/core-design';
import { KB_TUNER_INSTRUMENT } from '@kitbag/core-native';
import { useCallback, useState } from 'react';
import { TextInput, View } from 'react-native';

import { noteName, spokenNoteName } from '../logic/notes.ts';
import {
  addString,
  INSTRUMENT_LABELS,
  isSavableDraft,
  removeString,
  STRING_COUNT_BOUNDS,
  stepStringNote,
  stringNumber,
  type TuningDraft,
} from '../logic/tunings.ts';

// No drawing exists for this sheet (SPEC §12.8); it is built from existing
// primitives and awaits design sign-off (docs/decisions.md, 2026-10-14).

const INSTRUMENT_OPTIONS = Object.values(KB_TUNER_INSTRUMENT).map((value) => ({
  value: String(value),
  label: INSTRUMENT_LABELS[value] ?? '',
}));

const useStyles = createThemedStyles((theme) => ({
  name: {
    ...textStyle(textRoles.fieldLabel),
    color: theme.color.text,
    backgroundColor: theme.color.surface2,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    borderRadius: radius.button,
    paddingVertical: inset.buttonV,
    paddingHorizontal: inset.buttonH,
  },
  strings: {
    gap: space.controlGap,
  },
  row: {
    flexDirection: 'row',
    gap: space.controlGap,
  },
}));

interface StringStepperProps {
  readonly index: number;
  readonly notes: readonly number[];
  readonly onStep: (index: number, delta: StepDelta) => void;
}

function StringStepper({ index, notes, onStep }: StringStepperProps) {
  const note = notes[index] ?? 0;
  const handleStep = useCallback(
    (delta: StepDelta) => {
      onStep(index, delta);
    },
    [index, onStep],
  );
  return (
    <StepControl
      variant="inline"
      label={`String ${String(stringNumber(index, notes.length))}`}
      value={noteName(note)}
      accessibilityValue={spokenNoteName(note)}
      onStep={handleStep}
    />
  );
}

export interface TuningEditorSheetProps {
  readonly visible: boolean;
  /** The draft the sheet opens on; read on show. */
  readonly initial: TuningDraft;
  readonly isNew: boolean;
  readonly bottomInset: number;
  readonly onSave: (draft: TuningDraft) => Promise<void>;
  readonly onDelete: () => Promise<void>;
  readonly onDismiss: () => void;
}

export function TuningEditorSheet({
  visible,
  initial,
  isNew,
  bottomInset,
  onSave,
  onDelete,
  onDismiss,
}: TuningEditorSheetProps) {
  const styles = useStyles();
  const theme = useTheme();
  const [draft, setDraft] = useState(initial);
  const [failed, setFailed] = useState(false);

  const handleShow = useCallback(() => {
    setDraft(initial);
    setFailed(false);
  }, [initial]);

  const handleName = useCallback((name: string) => {
    setDraft((d) => ({ ...d, name }));
  }, []);

  const handleInstrument = useCallback((value: string) => {
    setDraft((d) => ({ ...d, instrument: Number(value) }));
  }, []);

  const handleStep = useCallback((index: number, delta: StepDelta) => {
    setDraft((d) => ({ ...d, notes: stepStringNote(d.notes, index, delta) }));
  }, []);

  const handleAdd = useCallback(() => {
    setDraft((d) => ({ ...d, notes: addString(d.notes) }));
  }, []);

  const handleRemove = useCallback(() => {
    setDraft((d) => ({ ...d, notes: removeString(d.notes) }));
  }, []);

  const handleSave = useCallback(() => {
    onSave(draft).then(onDismiss, () => {
      setFailed(true);
    });
  }, [draft, onSave, onDismiss]);

  const handleDelete = useCallback(() => {
    onDelete().then(onDismiss, () => {
      setFailed(true);
    });
  }, [onDelete, onDismiss]);

  return (
    <Sheet
      visible={visible}
      title={isNew ? 'New tuning' : 'Edit tuning'}
      dismissLabel="Close tuning editor"
      bottomInset={bottomInset}
      onShow={handleShow}
      onDismiss={onDismiss}
    >
      <TextInput
        accessibilityLabel="Tuning name"
        placeholder="Name"
        placeholderTextColor={theme.color.text3}
        value={draft.name}
        onChangeText={handleName}
        style={styles.name}
      />
      <SegmentedControl
        accessibilityLabel="Instrument"
        options={INSTRUMENT_OPTIONS}
        selected={String(draft.instrument)}
        onSelect={handleInstrument}
      />
      <View style={styles.strings}>
        {draft.notes.map((_note, index) => (
          <StringStepper
            key={index}
            index={index}
            notes={draft.notes}
            onStep={handleStep}
          />
        ))}
      </View>
      <View style={styles.row}>
        <Button
          label="Add string"
          variant="tonal"
          disabled={draft.notes.length >= STRING_COUNT_BOUNDS.max}
          onPress={handleAdd}
        />
        <Button
          label="Remove string"
          variant="tonal"
          disabled={draft.notes.length <= STRING_COUNT_BOUNDS.min}
          onPress={handleRemove}
        />
      </View>
      {failed ? <SheetHint>Couldn&apos;t save that change.</SheetHint> : null}
      <Button
        label="Save"
        disabled={!isSavableDraft(draft)}
        onPress={handleSave}
      />
      {isNew ? null : (
        <Button label="Delete" variant="destructive" onPress={handleDelete} />
      )}
    </Sheet>
  );
}
