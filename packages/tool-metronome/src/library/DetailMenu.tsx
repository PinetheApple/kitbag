import { useLibrary, type SetlistEntry } from '@kitbag/core-state';
import { useCallback, useMemo, useState } from 'react';

import { ActionsSheet, ConfirmSheet, type SheetAction } from './sheets.tsx';

type Kind = 'none' | 'add' | 'save';

export const NEW_SONG_NAME = 'New song';

export function useDetailMenu() {
  const [kind, setKind] = useState<Kind>('none');
  const [error, setError] = useState<string | null>(null);
  const openAdd = useCallback(() => {
    setKind('add');
    setError(null);
  }, []);
  const openSave = useCallback(() => {
    setKind('save');
    setError(null);
  }, []);
  const close = useCallback(() => {
    setKind('none');
    setError(null);
  }, []);
  return useMemo(
    () => ({ kind, error, setError, openAdd, openSave, close }),
    [kind, error, openAdd, openSave, close],
  );
}

export type DetailMenu = ReturnType<typeof useDetailMenu>;

interface DetailSheetsProps {
  readonly menu: DetailMenu;
  readonly setlistId: number;
  readonly entries: readonly SetlistEntry[];
  readonly bottomInset: number;
  readonly onEdit: (presetId: number) => void;
}

function useAddActions({
  menu,
  setlistId,
  entries,
  onEdit,
}: DetailSheetsProps): SheetAction[] {
  const presets = useLibrary((s) => s.presets);
  const addToSetlist = useLibrary((s) => s.addToSetlist);
  const newSong = useLibrary((s) => s.newSongFromCurrent);
  const inSet = new Set(entries.map((e) => e.preset.id));
  const create: SheetAction = {
    label: 'New song from the metronome',
    variant: 'primary',
    onPress: async () => {
      menu.setError(null);
      try {
        onEdit(await newSong(NEW_SONG_NAME, setlistId));
        menu.close();
      } catch {
        menu.setError('Could not create the song. Try again.');
      }
    },
  };
  const existing = presets
    .filter((p) => !inSet.has(p.id))
    .map((p) => ({
      label: p.name,
      onPress: async () => {
        menu.setError(null);
        try {
          await addToSetlist(setlistId, p.id);
          menu.close();
        } catch {
          menu.setError('Could not add the song. Try again.');
        }
      },
    }));
  return [create, ...existing];
}

export function DetailSheets(props: DetailSheetsProps) {
  const actions = useAddActions(props);
  const saveCurrentInto = useLibrary((s) => s.saveCurrentInto);
  const loaded = useLibrary((s) => s.loaded);
  const song = props.entries.find((e) => e.item.id === loaded?.itemId)?.preset;
  const { menu } = props;
  const save = useCallback(async () => {
    if (song === undefined) return;
    menu.setError(null);
    try {
      await saveCurrentInto(song.id);
      menu.close();
    } catch {
      menu.setError('Could not overwrite the song. Try again.');
    }
  }, [menu, song, saveCurrentInto]);
  const common = {
    bottomInset: props.bottomInset,
    onDismiss: menu.close,
    error: menu.error,
  };
  return (
    <>
      <ActionsSheet
        {...common}
        visible={menu.kind === 'add'}
        title="Add song"
        actions={actions}
      />
      <ConfirmSheet
        {...common}
        visible={menu.kind === 'save'}
        title="Save current?"
        body={`The metronome's tempo, signature, accents and trainers overwrite “${song?.name ?? ''}”.`}
        confirmLabel="Overwrite"
        onConfirm={save}
      />
    </>
  );
}
