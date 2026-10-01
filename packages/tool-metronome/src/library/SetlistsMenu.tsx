import { useLibrary } from '@kitbag/core-state';
import { useCallback, useMemo, useState } from 'react';

import { ActionsSheet, ConfirmSheet, NameSheet } from './sheets.tsx';

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
  const library = useLibrary((s) => s);
  const target = 'setlistId' in menu.open ? menu.open.setlistId : -1;
  const found = library.setlists.find((s) => s.setlist.id === target);
  const { close, onCreated } = menu;
  const run = async (work: () => Promise<unknown>) => {
    menu.setError(null);
    try {
      await work();
      close();
    } catch {
      menu.setError('Could not save this change. Try again.');
    }
  };
  return {
    name: found?.setlist.name ?? '',
    create: async (v: string) => {
      await run(async () => {
        onCreated(await library.createSetlist(v));
      });
    },
    rename: async (v: string) => {
      await run(() => library.renameSetlist(target, v));
    },
    duplicate: async () => {
      await run(() => library.duplicateSetlist(target));
    },
    remove: async () => {
      await run(() => library.deleteSetlist(target));
    },
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
