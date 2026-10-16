import { useLibrary, type SongPreset } from '@kitbag/core-state';
import { useCallback, useMemo, useState } from 'react';

import {
  ActionsSheet,
  ConfirmSheet,
  guarded,
  type SheetAction,
} from './sheets.tsx';

export interface SongTarget {
  readonly preset: SongPreset;
  readonly itemId: number | null;
}

type Kind = 'none' | 'actions' | 'move' | 'delete';

export function useSongMenu() {
  const [kind, setKind] = useState<Kind>('none');
  const [target, setTarget] = useState<SongTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const openActions = useCallback((next: SongTarget) => {
    setTarget(next);
    setKind('actions');
    setError(null);
  }, []);
  const close = useCallback(() => {
    setKind('none');
    setError(null);
  }, []);
  return useMemo(
    () => ({
      kind,
      target,
      error,
      setError,
      openActions,
      close,
      go: setKind,
    }),
    [kind, target, error, openActions, close],
  );
}

export type SongMenu = ReturnType<typeof useSongMenu>;

export interface SongMenuProps {
  readonly menu: SongMenu;
  readonly setlistId: number | null;
  readonly bottomInset: number;
  readonly onEdit: (presetId: number) => void;
}

function useSongActions() {
  return {
    duplicatePreset: useLibrary((s) => s.duplicatePreset),
    removeFromSet: useLibrary((s) => s.removeFromSet),
    deletePreset: useLibrary((s) => s.deletePreset),
    addToSetlist: useLibrary((s) => s.addToSetlist),
    moveToSetlist: useLibrary((s) => s.moveToSetlist),
  };
}

function useSongCommands({ menu, setlistId, onEdit }: SongMenuProps) {
  const library = useSongActions();
  const { target, close } = menu;
  const run = (work: (song: SongTarget) => Promise<unknown>) => async () => {
    if (target === null) return;
    await guarded(
      menu.setError,
      'Could not save this change. Try again.',
      async () => {
        await work(target);
        close();
      },
    );
  };
  return {
    edit: () => {
      close();
      if (target !== null) onEdit(target.preset.id);
    },
    duplicate: run(({ preset }) =>
      library.duplicatePreset(preset.id, setlistId ?? undefined),
    ),
    remove: run(({ itemId }) =>
      itemId === null ? Promise.resolve() : library.removeFromSet(itemId),
    ),
    destroy: run(({ preset }) => library.deletePreset(preset.id)),
    moveTo: (destination: number) =>
      run(({ preset, itemId }) =>
        itemId === null
          ? library.addToSetlist(destination, preset.id)
          : library.moveToSetlist(itemId, destination),
      ),
  };
}

type SongCommands = ReturnType<typeof useSongCommands>;

function songActions(cmd: SongCommands, menu: SongMenu, inSet: boolean) {
  const actions: SheetAction[] = [
    { label: 'Edit', onPress: cmd.edit },
    { label: 'Duplicate', onPress: cmd.duplicate },
    {
      label: inSet ? 'Move to setlist' : 'Add to setlist',
      onPress: () => {
        menu.go('move');
      },
    },
  ];
  if (inSet) actions.push({ label: 'Remove from set', onPress: cmd.remove });
  actions.push({
    label: 'Delete song',
    variant: 'destructive',
    onPress: () => {
      menu.go('delete');
    },
  });
  return actions;
}

const IN_SET_HINT =
  'Remove from set keeps the song in All songs. Delete song removes it from every setlist.';

function useDestinations(props: SongMenuProps, cmd: SongCommands) {
  const setlists = useLibrary((s) => s.setlists);
  return setlists
    .filter((s) => s.setlist.id !== props.setlistId)
    .map((s) => ({ label: s.setlist.name, onPress: cmd.moveTo(s.setlist.id) }));
}

function SongDelete({
  menu,
  bottomInset,
  cmd,
}: SongMenuProps & { readonly cmd: SongCommands }) {
  const name = menu.target?.preset.name ?? '';
  return (
    <ConfirmSheet
      error={menu.error}
      bottomInset={bottomInset}
      onDismiss={menu.close}
      visible={menu.kind === 'delete'}
      title="Delete song?"
      body={`“${name}” is deleted from All songs and from every setlist. This cannot be undone.`}
      confirmLabel="Delete song"
      destructive
      onConfirm={cmd.destroy}
    />
  );
}

export function SongMenuSheets(props: SongMenuProps) {
  const cmd = useSongCommands(props);
  const destinations = useDestinations(props, cmd);
  const { menu } = props;
  const name = menu.target?.preset.name ?? '';
  const inSet = menu.target?.itemId !== null && props.setlistId !== null;
  const common = {
    bottomInset: props.bottomInset,
    onDismiss: menu.close,
    error: menu.error,
  };
  const moveTitle = inSet ? `Move “${name}” to` : `Add “${name}” to`;
  const noOther =
    destinations.length === 0 ? 'There is no other setlist yet.' : undefined;
  return (
    <>
      <ActionsSheet
        {...common}
        visible={menu.kind === 'actions'}
        title={name}
        actions={songActions(cmd, menu, inSet)}
        hint={inSet ? IN_SET_HINT : undefined}
      />
      <ActionsSheet
        {...common}
        visible={menu.kind === 'move'}
        title={moveTitle}
        actions={destinations}
        hint={noOther}
      />
      <SongDelete {...props} cmd={cmd} />
    </>
  );
}
