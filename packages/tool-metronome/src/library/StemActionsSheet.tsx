import { useLibrary, type StemSetlistEntry } from '@kitbag/core-state';
import { useCallback, useState } from 'react';

import { CHANGE_NOT_SAVED, REMOVE_FROM_SET } from './setlistCopy.ts';
import { ActionsSheet, guarded } from './sheets.tsx';

export interface StemActionsTarget {
  readonly itemId: number;
  readonly name: string;
}

export function useStemActions() {
  const [target, setTarget] = useState<StemActionsTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = useCallback((entry: StemSetlistEntry, name: string) => {
    setError(null);
    setTarget({ itemId: entry.item.id, name });
  }, []);
  const close = useCallback(() => {
    setTarget(null);
  }, []);
  return { target, error, setError, open, close };
}

export type StemActions = ReturnType<typeof useStemActions>;

export function StemActionsSheet({
  actions,
  bottomInset,
}: {
  readonly actions: StemActions;
  readonly bottomInset: number;
}) {
  const removeFromSet = useLibrary((s) => s.removeFromSet);
  const { target, close, setError } = actions;
  const remove = useCallback(
    () =>
      guarded(setError, CHANGE_NOT_SAVED, async () => {
        if (target !== null) await removeFromSet(target.itemId);
        close();
      }),
    [setError, target, removeFromSet, close],
  );
  return (
    <ActionsSheet
      visible={target !== null}
      title={target?.name ?? ''}
      bottomInset={bottomInset}
      onDismiss={close}
      error={actions.error}
      actions={[{ label: REMOVE_FROM_SET, onPress: remove }]}
    />
  );
}
