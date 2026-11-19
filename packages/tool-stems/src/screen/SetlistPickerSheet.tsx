import {
  Button,
  MenuRow,
  Sheet,
  SheetHint,
  TextField,
} from '@kitbag/core-design';
import { useLibrary, type SetlistSummary } from '@kitbag/core-state';
import { useCallback, useEffect, useState } from 'react';

import { pickerSubtitle } from '../logic/upNextText.ts';

export const NO_SETLISTS_HINT =
  'You have no setlists yet. A new one starts with this song.';
const ALREADY_IN_IT = 'Already in it';
const ADD_FAILED = 'Could not add the song. Try again.';

export interface AddedToSetlist {
  readonly setlistId: number;
  readonly name: string;
}

interface PickRowProps {
  readonly summary: SetlistSummary;
  readonly stemSetId: number;
  readonly onPick: (summary: SetlistSummary) => void;
}

function PickRow({ summary, stemSetId, onPick }: PickRowProps) {
  const entries = useLibrary((s) => s.entries[summary.setlist.id]);
  const list = entries ?? [];
  const holds = list.some((e) => 'stemSetId' in e && e.stemSetId === stemSetId);
  const pick = useCallback(() => {
    onPick(summary);
  }, [onPick, summary]);
  return (
    <MenuRow
      icon={summary.setlist.active ? 'practice' : 'setlist'}
      label={summary.setlist.name}
      detail={pickerSubtitle(summary, list)}
      value={holds ? ALREADY_IN_IT : undefined}
      onPress={pick}
    />
  );
}

interface NameStepProps {
  readonly onCreate: (name: string) => void;
}

function NameStep({ onCreate }: NameStepProps) {
  const [name, setName] = useState('');
  const submit = useCallback(() => {
    if (name.trim() !== '') onCreate(name.trim());
  }, [name, onCreate]);
  return (
    <>
      <TextField
        autoFocus
        value={name}
        onChangeText={setName}
        placeholder="Name"
        accessibilityLabel="Setlist name"
        onSubmitEditing={submit}
      />
      <Button
        variant="primary"
        label="Create and add"
        disabled={name.trim() === ''}
        onPress={submit}
      />
    </>
  );
}

export interface SetlistPickerSheetProps {
  readonly visible: boolean;
  readonly songTitle: string;
  readonly stemSetId: number;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
  readonly onAdded: (added: AddedToSetlist) => void;
}

function usePicker(props: SetlistPickerSheetProps) {
  const addStemToSetlist = useLibrary((s) => s.addStemToSetlist);
  const createSetlist = useLibrary((s) => s.createSetlist);
  const [error, setError] = useState<string | null>(null);
  const { stemSetId, onAdded, onDismiss } = props;
  const addTo = useCallback(
    async (setlistId: number, name: string) => {
      setError(null);
      try {
        await addStemToSetlist(setlistId, stemSetId);
      } catch {
        setError(ADD_FAILED);
        return;
      }
      onDismiss();
      onAdded({ setlistId, name });
    },
    [addStemToSetlist, stemSetId, onDismiss, onAdded],
  );
  const pick = useCallback(
    (summary: SetlistSummary) => {
      void addTo(summary.setlist.id, summary.setlist.name);
    },
    [addTo],
  );
  const create = useCallback(
    (name: string) => {
      void createSetlist(name).then(
        (setlistId) => addTo(setlistId, name),
        () => {
          setError(ADD_FAILED);
        },
      );
    },
    [createSetlist, addTo],
  );
  return { error, setError, pick, create };
}

export function SetlistPickerSheet(props: SetlistPickerSheetProps) {
  const setlists = useLibrary((s) => s.setlists);
  const refresh = useLibrary((s) => s.refresh);
  const [naming, setNaming] = useState(false);
  const picker = usePicker(props);
  const { visible, onDismiss } = props;
  useEffect(() => {
    if (!visible) return;
    setNaming(false);
    picker.setError(null);
    void refresh();
    // A fresh read per opening, not per new callback identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  const startNaming = useCallback(() => {
    setNaming(true);
  }, []);
  return (
    <Sheet
      visible={visible}
      title={`Add “${props.songTitle}” to a setlist`}
      dismissLabel="Close Add to setlist"
      bottomInset={props.bottomInset}
      onDismiss={onDismiss}
    >
      {naming ? (
        <NameStep onCreate={picker.create} />
      ) : (
        <>
          {setlists.map((summary) => (
            <PickRow
              key={summary.setlist.id}
              summary={summary}
              stemSetId={props.stemSetId}
              onPick={picker.pick}
            />
          ))}
          <MenuRow icon="add" label="New setlist" onPress={startNaming} />
          {setlists.length === 0 ? (
            <SheetHint>{NO_SETLISTS_HINT}</SheetHint>
          ) : null}
        </>
      )}
      {picker.error === null ? null : <SheetHint>{picker.error}</SheetHint>}
      <Button variant="ghost" label="Cancel" onPress={onDismiss} />
    </Sheet>
  );
}
