import { useLibrary } from '@kitbag/core-state';
import { useCallback, useMemo, useState } from 'react';

import { ActionsSheet, ConfirmSheet, guarded, NameSheet } from './sheets.tsx';

type Open =
  | { readonly kind: 'none' }
  | { readonly kind: 'create' }
  | {
      readonly kind: 'actions' | 'rename' | 'delete';
      readonly setlistId: number;
    };

const NONE: Open = { kind: 'none' };

export function useSetlistsMenu(onCreated: (setlistId: number) => void) {
  const [open, setOpen] = useState<Open>(NONE);
  const [error, setError] = useState<string | null>(null);
  const close = useCallback(() => {
    setOpen(NONE);
    setError(null);
  }, []);
  const openCreate = useCallback(() => {
    setOpen({ kind: 'create' });
    setError(null);
  }, []);
  const openActions = useCallback((setlistId: number) => {
    setOpen({ kind: 'actions', setlistId });
    setError(null);
  }, []);
  const to = useCallback((kind: 'rename' | 'delete') => {
    setOpen((o) =>
      'setlistId' in o ? { kind, setlistId: o.setlistId } : NONE,
    );
    setError(null);
  }, []);
  return useMemo(
    () => ({
      open,
      error,
      setError,
      close,
      openCreate,
      openActions,
      to,
      onCreated,
    }),
    [open, error, close, openCreate, openActions, to, onCreated],
  );
}

export type SetlistsMenu = ReturnType<typeof useSetlistsMenu>;

function useSetlistCommands(menu: SetlistsMenu) {
  const createSetlist = useLibrary((s) => s.createSetlist);
  const renameSetlist = useLibrary((s) => s.renameSetlist);
  const duplicateSetlist = useLibrary((s) => s.duplicateSetlist);
  const deleteSetlist = useLibrary((s) => s.deleteSetlist);
  const target = 'setlistId' in menu.open ? menu.open.setlistId : undefined;
  const name = useLibrary(
    (s) => s.setlists.find((x) => x.setlist.id === target)?.setlist.name ?? '',
  );
  const { close, onCreated } = menu;
  const run = (work: () => Promise<unknown>) =>
    guarded(
      menu.setError,
      'Could not save this change. Try again.',
      async () => {
        await work();
        close();
      },
    );
  const onTarget = (work: (setlistId: number) => Promise<unknown>) =>
    target === undefined ? Promise.resolve() : run(() => work(target));
  return {
    name,
    create: (v: string) =>
      run(async () => {
        onCreated(await createSetlist(v));
      }),
    rename: (v: string) => onTarget((id) => renameSetlist(id, v)),
    duplicate: () => onTarget(duplicateSetlist),
    remove: () => onTarget(deleteSetlist),
  };
}

interface SheetsProps {
  readonly menu: SetlistsMenu;
  readonly bottomInset: number;
}

function SetlistActions({ menu, bottomInset }: SheetsProps) {
  const cmd = useSetlistCommands(menu);
  const actions = [
    {
      label: 'Rename',
      onPress: () => {
        menu.to('rename');
      },
    },
    { label: 'Duplicate', onPress: cmd.duplicate },
    {
      label: 'Delete setlist',
      variant: 'destructive' as const,
      onPress: () => {
        menu.to('delete');
      },
    },
  ];
  return (
    <ActionsSheet
      bottomInset={bottomInset}
      error={menu.error}
      onDismiss={menu.close}
      visible={menu.open.kind === 'actions'}
      title={cmd.name}
      actions={actions}
    />
  );
}

function SetlistNaming({ menu, bottomInset }: SheetsProps) {
  const cmd = useSetlistCommands(menu);
  const common = {
    bottomInset,
    onDismiss: menu.close,
    error: menu.error,
  };
  return (
    <>
      <NameSheet
        {...common}
        visible={menu.open.kind === 'create'}
        title="New setlist"
        initial=""
        confirmLabel="Create"
        onSubmit={cmd.create}
      />
      <NameSheet
        {...common}
        visible={menu.open.kind === 'rename'}
        title="Rename setlist"
        initial={cmd.name}
        confirmLabel="Rename"
        onSubmit={cmd.rename}
      />
    </>
  );
}

function SetlistDelete({ menu, bottomInset }: SheetsProps) {
  const cmd = useSetlistCommands(menu);
  return (
    <ConfirmSheet
      bottomInset={bottomInset}
      error={menu.error}
      onDismiss={menu.close}
      visible={menu.open.kind === 'delete'}
      title="Delete setlist?"
      body={`“${cmd.name}” is deleted. Its songs stay in All songs.`}
      confirmLabel="Delete setlist"
      destructive
      onConfirm={cmd.remove}
    />
  );
}

export function SetlistsSheets(props: SheetsProps) {
  return (
    <>
      <SetlistActions {...props} />
      <SetlistNaming {...props} />
      <SetlistDelete {...props} />
    </>
  );
}
