import {
  isPresetEntry,
  useLibrary,
  type PresetSetlistEntry,
  type SetlistEntry,
} from '@kitbag/core-state';
import { useCallback, useMemo, useState } from 'react';

import { AddSongSheet } from './AddSongSheet.tsx';
import { ConfirmSheet, guarded, type SheetAction } from './sheets.tsx';

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
  readonly onAddStemSongs: () => void;
}

interface AddActionsProps extends Omit<DetailSheetsProps, 'entries'> {
  readonly entries: readonly PresetSetlistEntry[];
}

function useAddActions({
  menu,
  setlistId,
  entries,
  onEdit,
}: AddActionsProps): SheetAction[] {
  const songs = useLibrary((s) => s.metronomeSongs);
  const addToSetlist = useLibrary((s) => s.addToSetlist);
  const newSong = useLibrary((s) => s.newSongFromCurrent);
  const inSet = new Set(entries.map((e) => e.preset.id));
  const create: SheetAction = {
    label: 'New song from the metronome',
    variant: 'primary',
    onPress: () =>
      guarded(
        menu.setError,
        'Could not create the song. Try again.',
        async () => {
          onEdit(await newSong(NEW_SONG_NAME, setlistId));
          menu.close();
        },
      ),
  };
  const existing = songs
    .filter((p) => !inSet.has(p.id))
    .map((p) => ({
      label: p.name,
      onPress: () =>
        guarded(
          menu.setError,
          'Could not add the song. Try again.',
          async () => {
            await addToSetlist(setlistId, p.id);
            menu.close();
          },
        ),
    }));
  return [create, ...existing];
}

export function DetailSheets(props: DetailSheetsProps) {
  const metronomeEntries = props.entries.filter(isPresetEntry);
  const stemSetIds = props.entries.flatMap((e) =>
    isPresetEntry(e) ? [] : [e.stemSetId],
  );
  const actions = useAddActions({ ...props, entries: metronomeEntries });
  const saveCurrentInto = useLibrary((s) => s.saveCurrentInto);
  const loaded = useLibrary((s) => s.loaded);
  const song = metronomeEntries.find(
    (e) => e.item.id === loaded?.itemId,
  )?.preset;
  const { menu } = props;
  const save = useCallback(async () => {
    if (song === undefined) return;
    await guarded(
      menu.setError,
      'Could not overwrite the song. Try again.',
      async () => {
        await saveCurrentInto(song.id);
        menu.close();
      },
    );
  }, [menu, song, saveCurrentInto]);
  const common = {
    bottomInset: props.bottomInset,
    onDismiss: menu.close,
    error: menu.error,
  };
  return (
    <>
      <AddSongSheet
        {...common}
        visible={menu.kind === 'add'}
        setlistId={props.setlistId}
        stemSetIds={stemSetIds}
        metronomeActions={actions}
        onError={menu.setError}
        onAddStemSongs={props.onAddStemSongs}
      />
      <ConfirmSheet
        {...common}
        visible={menu.kind === 'save'}
        title="Save current?"
        body={`Everything the metronome is set to — tempo, signature, subdivision, accents, poly, sound, count-in, ramp and mute bars — overwrites “${song?.name ?? ''}”. Its name and notes stay.`}
        confirmLabel="Overwrite"
        onConfirm={save}
      />
    </>
  );
}
