import { useCallback, useEffect, useState } from 'react';

import {
  pickerSubtitle,
  type AddedToSetlist,
  type SetlistPick,
} from '../setlistPickText.ts';
import { Button } from './Button.tsx';
import { MenuRow } from './MenuRow.tsx';
import { Sheet, SheetHint } from './Sheet.tsx';
import { TextField } from './TextField.tsx';
import { useAfterSheetClosed } from './useAfterSheetClosed.ts';

export const NO_SETLISTS_HINT =
  'You have no setlists yet. A new one starts with this song.';
const ALREADY_IN_IT = 'Already in it';
const ADD_FAILED = 'Could not add the song. Try again.';

interface PickRowProps {
  readonly pick: SetlistPick;
  readonly onPick: (pick: SetlistPick) => void;
}

function PickRow({ pick, onPick }: PickRowProps) {
  const press = useCallback(() => {
    onPick(pick);
  }, [onPick, pick]);
  return (
    <MenuRow
      icon={pick.onStage ? 'practice' : 'setlist'}
      label={pick.name}
      detail={pickerSubtitle(pick)}
      value={pick.holds ? ALREADY_IN_IT : undefined}
      onPress={press}
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
  readonly picks: readonly SetlistPick[];
  readonly bottomInset: number;
  readonly onOpen: () => void;
  readonly onAdd: (setlistId: number) => Promise<void>;
  readonly onCreate: (name: string) => Promise<number>;
  readonly onDismiss: () => void;
  readonly onAdded: (added: AddedToSetlist) => void;
}

function usePicker(
  props: SetlistPickerSheetProps,
  afterClose: (then: () => void) => void,
) {
  const [error, setError] = useState<string | null>(null);
  const { onAdd, onCreate, onAdded, onDismiss } = props;
  const addTo = useCallback(
    async (setlistId: number, name: string) => {
      setError(null);
      try {
        await onAdd(setlistId);
      } catch {
        setError(ADD_FAILED);
        return;
      }
      afterClose(() => {
        onAdded({ setlistId, name });
      });
      onDismiss();
    },
    [onAdd, onDismiss, onAdded, afterClose],
  );
  const pick = useCallback(
    (picked: SetlistPick) => {
      void addTo(picked.id, picked.name);
    },
    [addTo],
  );
  const create = useCallback(
    (name: string) => {
      void onCreate(name).then(
        (setlistId) => addTo(setlistId, name),
        () => {
          setError(ADD_FAILED);
        },
      );
    },
    [onCreate, addTo],
  );
  return { error, setError, pick, create };
}

export function SetlistPickerSheet(props: SetlistPickerSheetProps) {
  const [naming, setNaming] = useState(false);
  const exit = useAfterSheetClosed(props.visible);
  const picker = usePicker(props, exit.after);
  const { visible, picks, onOpen, onDismiss } = props;
  useEffect(() => {
    if (!visible) return;
    setNaming(false);
    picker.setError(null);
    onOpen();
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
      onClosed={exit.closed}
    >
      {naming ? (
        <NameStep onCreate={picker.create} />
      ) : (
        <>
          {picks.map((pick) => (
            <PickRow key={pick.id} pick={pick} onPick={picker.pick} />
          ))}
          <MenuRow icon="add" label="New setlist" onPress={startNaming} />
          {picks.length === 0 ? (
            <SheetHint>{NO_SETLISTS_HINT}</SheetHint>
          ) : null}
        </>
      )}
      {picker.error === null ? null : <SheetHint>{picker.error}</SheetHint>}
      <Button variant="ghost" label="Cancel" onPress={onDismiss} />
    </Sheet>
  );
}
