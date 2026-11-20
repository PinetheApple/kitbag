import {
  Button,
  createThemedStyles,
  Sheet,
  SheetHint,
  space,
  TextField,
} from '@kitbag/core-design';
import {
  cleanName,
  REPLACE_LABELS,
  useSongLibrary,
  type AnalysisFailure,
  type LibraryRow,
} from '@kitbag/core-state';
import { useCallback, useMemo, useRef, useState } from 'react';
import { View, type TextInput } from 'react-native';

import {
  canReanalyze,
  failureText,
  replaceText,
  UNAVAILABLE_TEXT,
  type FailureText,
} from '../logic/notices.ts';
import {
  REANALYZE_LABEL,
  REPLACE_SHEET_TEXT,
  replaceButtonLabel,
  replaceSheetTitle,
} from '../logic/viewText.ts';
import { useRowFailure, useRowFiles } from './rowFailureHooks.ts';

const useStyles = createThemedStyles(() => ({
  stack: { gap: space.controlGap },
  row: { flexDirection: 'row', gap: space.controlGap },
}));

type Kind = 'none' | 'actions' | 'rename' | 'delete';

export function useLibraryMenu() {
  const [kind, setKind] = useState<Kind>('none');
  const [target, setTarget] = useState<LibraryRow | null>(null);
  const openActions = useCallback((row: LibraryRow) => {
    setTarget(row);
    setKind('actions');
  }, []);
  const openRename = useCallback(() => {
    setKind('rename');
  }, []);
  const openDelete = useCallback(() => {
    setKind('delete');
  }, []);
  const close = useCallback(() => {
    setKind('none');
  }, []);
  return useMemo(
    () => ({
      kind,
      target,
      openActions,
      openRename,
      openDelete,
      close,
    }),
    [kind, target, openActions, openRename, openDelete, close],
  );
}

export type LibraryMenu = ReturnType<typeof useLibraryMenu>;

interface SheetProps {
  readonly menu: LibraryMenu;
  readonly bottomInset: number;
}

function sheetNotice(
  failure: AnalysisFailure | null,
  away: boolean,
): FailureText | null {
  if (failure !== null) return failureText(failure);
  return away ? UNAVAILABLE_TEXT : null;
}

function ActionsSheet({ menu, bottomInset }: SheetProps) {
  const styles = useStyles();
  const reanalyze = useSongLibrary((s) => s.reanalyze);
  const { target, close, openRename, openDelete } = menu;
  const failure = useRowFailure(target);
  const away = useRowFiles(target) === 'unavailable';
  const failureNotice = sheetNotice(failure, away);
  const retry = useCallback(() => {
    close();
    if (target?.kind === 'song') void reanalyze(target.id);
  }, [close, reanalyze, target]);
  const title = target?.title ?? '';
  return (
    <Sheet
      visible={menu.kind === 'actions'}
      title={title}
      dismissLabel={`Close ${title}`}
      bottomInset={bottomInset}
      onDismiss={close}
    >
      {failureNotice === null ? null : (
        <SheetHint>{failureNotice.text}</SheetHint>
      )}
      <View style={styles.stack}>
        <Button label="Rename" variant="tonal" onPress={openRename} />
        {target?.kind === 'song' && !away && canReanalyze(failure) ? (
          <Button label={REANALYZE_LABEL} variant="tonal" onPress={retry} />
        ) : null}
        {away ? null : (
          <Button
            label={
              target?.kind === 'stems' ? 'Delete stem song' : 'Delete song'
            }
            variant="destructive"
            onPress={openDelete}
          />
        )}
      </View>
    </Sheet>
  );
}

function RenameSheet({ menu, bottomInset }: SheetProps) {
  const styles = useStyles();
  const renameRow = useSongLibrary((s) => s.renameRow);
  const { target, close } = menu;
  const title = target?.title ?? '';
  const [draft, setDraft] = useState(title);
  const field = useRef<TextInput>(null);
  const blank = cleanName(draft) === null;
  const prefill = useCallback(() => {
    setDraft(title);
  }, [title]);
  const clear = useCallback(() => {
    setDraft('');
    field.current?.focus();
  }, []);
  const save = useCallback(() => {
    if (target === null || blank) return;
    close();
    void renameRow(target, draft);
  }, [target, blank, close, renameRow, draft]);
  return (
    <Sheet
      visible={menu.kind === 'rename'}
      title={target?.kind === 'stems' ? 'Rename stem song' : 'Rename song'}
      dismissLabel="Cancel rename"
      bottomInset={bottomInset}
      onShow={prefill}
      onDismiss={close}
    >
      <TextField
        ref={field}
        value={draft}
        onChangeText={setDraft}
        placeholder="Song name"
        accessibilityLabel={`New name for ${title}`}
        autoFocus
        onSubmitEditing={save}
        onClear={clear}
      />
      <View style={styles.row}>
        <Button fill variant="ghost" label="Cancel" onPress={close} />
        <Button
          fill
          variant="primary"
          label="Save"
          disabled={blank}
          accessibilityLabel={`Save the new name for ${title}`}
          onPress={save}
        />
      </View>
    </Sheet>
  );
}

function DeleteSheet({ menu, bottomInset }: SheetProps) {
  const styles = useStyles();
  const deleteRow = useSongLibrary((s) => s.deleteRow);
  const { target, close } = menu;
  const confirm = useCallback(() => {
    close();
    if (target !== null) void deleteRow(target);
  }, [close, deleteRow, target]);
  const title = target?.title ?? '';
  return (
    <Sheet
      visible={menu.kind === 'delete'}
      title={`Delete “${title}”?`}
      dismissLabel="Cancel delete"
      bottomInset={bottomInset}
      onDismiss={close}
    >
      <SheetHint>
        Its audio and analysis are removed from this phone. Song presets that
        used it keep their settings. This cannot be undone.
      </SheetHint>
      <View style={styles.row}>
        <Button fill variant="ghost" label="Cancel" onPress={close} />
        <Button fill variant="destructive" label="Delete" onPress={confirm} />
      </View>
    </Sheet>
  );
}

function ReplaceSheet({ bottomInset }: Pick<SheetProps, 'bottomInset'>) {
  const styles = useStyles();
  const prompt = useSongLibrary((s) => s.replacePrompt);
  const confirmReplace = useSongLibrary((s) => s.confirmReplace);
  const keepBothCopies = useSongLibrary((s) => s.keepBoth);
  const cancel = useSongLibrary((s) => s.cancelReplace);
  const confirm = useCallback(() => {
    void confirmReplace();
  }, [confirmReplace]);
  const keepBoth = useCallback(() => {
    void keepBothCopies();
  }, [keepBothCopies]);
  const title = prompt?.title ?? '';
  const match = prompt?.match ?? 'job';
  const canKeepBoth = match === 'song';
  return (
    <Sheet
      visible={prompt !== null}
      title={replaceSheetTitle(title)}
      dismissLabel={REPLACE_SHEET_TEXT.dismiss}
      bottomInset={bottomInset}
      onDismiss={cancel}
    >
      <SheetHint>{replaceText(prompt?.name ?? '', title, match)}</SheetHint>
      <View style={styles.row}>
        <Button
          fill
          variant="ghost"
          label={
            canKeepBoth ? REPLACE_SHEET_TEXT.cancel : REPLACE_LABELS.keepCurrent
          }
          onPress={cancel}
        />
        {canKeepBoth ? (
          <Button
            fill
            variant="tonal"
            label={REPLACE_LABELS.keepBoth}
            onPress={keepBoth}
          />
        ) : null}
        <Button
          fill
          variant="destructive"
          label={REPLACE_LABELS.replace}
          accessibilityLabel={replaceButtonLabel(title)}
          onPress={confirm}
        />
      </View>
    </Sheet>
  );
}

export function LibrarySheets(props: SheetProps) {
  return (
    <>
      <ActionsSheet {...props} />
      <RenameSheet {...props} />
      <DeleteSheet {...props} />
      <ReplaceSheet bottomInset={props.bottomInset} />
    </>
  );
}
