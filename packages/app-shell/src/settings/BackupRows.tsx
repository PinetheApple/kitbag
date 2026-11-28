import {
  Button,
  createThemedStyles,
  EditRow,
  EditValue,
  Sheet,
} from '@kitbag/core-design';
import {
  beforeReplaceTakenAt,
  getBackup,
  restoreStore,
  saveLibraryBackup,
  shareLibraryBackup,
} from '@kitbag/core-state';
import { useCallback, useMemo, useReducer } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  backUpEvent,
  backUpRowValue,
  CLOSED_BACK_UP_SHEET,
  nextBackUpSheet,
  type BackUpAction,
} from './backUpSheetFlow.ts';
import {
  BACK_UP_LABEL,
  backupSummary,
  RESTORE_LABEL,
  SAVE_LABEL,
  SHARE_LABEL,
  UNDO_LAST_REPLACE_LABEL,
  undoReplaceValue,
} from './backupText.ts';
import { ACTIONS_ROW } from './restoreStyles.ts';
import { openUndoReplace } from './undoReplace.ts';
import { useFocusedText } from './useFocusedText.ts';

const useStyles = createThemedStyles(() => ({
  actions: ACTIONS_ROW,
}));

const BACK_UP_ACTIONS: Readonly<Record<BackUpAction, () => Promise<boolean>>> =
  {
    save: () => saveLibraryBackup(),
    share: () => shareLibraryBackup().then(() => true),
  };

const readSummary = () => getBackup().service().summary();
const readTakenAt = () => beforeReplaceTakenAt();

function useBackupSummary(): string | null {
  return useFocusedText(
    readSummary,
    backupSummary,
    'could not count the library',
  );
}

function useUndoReplaceValue(): string | null {
  return useFocusedText(
    readTakenAt,
    undoReplaceValue,
    'could not read the copy before replace',
  );
}

function BackUpSheet({
  visible,
  busy,
  onSave,
  onShare,
  onDismiss,
}: {
  readonly visible: boolean;
  readonly busy: boolean;
  readonly onSave: () => void;
  readonly onShare: () => void;
  readonly onDismiss: () => void;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <Sheet
      visible={visible}
      title={BACK_UP_LABEL}
      titleIcon="backupFile"
      dismissLabel="Close back up"
      bottomInset={insets.bottom}
      onDismiss={onDismiss}
    >
      <View style={styles.actions}>
        <Button
          fill
          variant="ghost"
          label={SAVE_LABEL}
          disabled={busy}
          onPress={onSave}
        />
        <Button
          fill
          variant="primary"
          label={SHARE_LABEL}
          disabled={busy}
          onPress={onShare}
        />
      </View>
    </Sheet>
  );
}

export function BackUpRow() {
  const summary = useBackupSummary();
  const [sheet, send] = useReducer(nextBackUpSheet, CLOSED_BACK_UP_SHEET);
  const handlers = useMemo(() => {
    const run = (action: BackUpAction) => () => {
      send('start');
      void backUpEvent(action, BACK_UP_ACTIONS[action]).then(send);
    };
    return {
      open: () => {
        send('open');
      },
      dismiss: () => {
        send('dismiss');
      },
      save: run('save'),
      share: run('share'),
    };
  }, []);
  const value = backUpRowValue(sheet, summary);
  return (
    <>
      <EditRow
        label={BACK_UP_LABEL}
        accessibilityLabel={
          value === null ? BACK_UP_LABEL : `${BACK_UP_LABEL}, ${value}`
        }
        onPress={handlers.open}
      >
        {value === null ? null : <EditValue muted>{value}</EditValue>}
      </EditRow>
      <BackUpSheet
        visible={sheet.open}
        busy={sheet.busy}
        onSave={handlers.save}
        onShare={handlers.share}
        onDismiss={handlers.dismiss}
      />
    </>
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

export function UndoReplaceRow({
  onOpenRestore,
}: {
  readonly onOpenRestore: () => void;
}) {
  const value = useUndoReplaceValue();
  const undo = useCallback(() => {
    openUndoReplace()
      .then((opened) => {
        if (opened) onOpenRestore();
      })
      .catch((error: unknown) => {
        console.warn('[kitbag] could not open the copy before replace', error);
      });
  }, [onOpenRestore]);
  if (value === null) return null;
  return (
    <EditRow
      label={UNDO_LAST_REPLACE_LABEL}
      accessibilityLabel={`${UNDO_LAST_REPLACE_LABEL}, ${value}`}
      onPress={undo}
    >
      <EditValue muted>{value}</EditValue>
    </EditRow>
  );
}
