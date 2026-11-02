import { EditRow, EditValue } from '@kitbag/core-design';
import {
  getBackup,
  restoreStore,
  shareLibraryBackup,
} from '@kitbag/core-state';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import {
  BACK_UP_LABEL,
  backupSummary,
  RESTORE_LABEL,
  SHARE_FAILED,
} from './backupText.ts';

function useBackupSummary(): string | null {
  const [summary, setSummary] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      getBackup()
        .service()
        .summary()
        .then((counts) => {
          if (live) setSummary(backupSummary(counts));
        })
        .catch((error: unknown) => {
          console.warn('[kitbag] could not count the library', error);
        });
      return () => {
        live = false;
      };
    }, []),
  );
  return summary;
}

export function BackUpRow() {
  const summary = useBackupSummary();
  const [shareFailed, setShareFailed] = useState(false);
  const backUp = useCallback(() => {
    setShareFailed(false);
    shareLibraryBackup().catch((error: unknown) => {
      console.warn('[kitbag] could not share the backup', error);
      setShareFailed(true);
    });
  }, []);
  const value = shareFailed ? SHARE_FAILED : summary;
  return (
    <EditRow
      label={BACK_UP_LABEL}
      accessibilityLabel={
        value === null ? BACK_UP_LABEL : `${BACK_UP_LABEL}, ${value}`
      }
      onPress={backUp}
    >
      {value === null ? null : <EditValue muted>{value}</EditValue>}
    </EditRow>
  );
}

export function RestoreRow({
  onOpenRestore,
}: {
  readonly onOpenRestore: () => void;
}) {
  const restore = useCallback(() => {
    void restoreStore
      .getState()
      .pick()
      .then(() => {
        if (restoreStore.getState().restore.phase !== 'empty') onOpenRestore();
      });
  }, [onOpenRestore]);
  return <EditRow label={RESTORE_LABEL} onPress={restore} />;
}
