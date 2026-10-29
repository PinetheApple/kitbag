import {
  Button,
  createThemedStyles,
  Sheet,
  SheetHint,
  space,
  TextField,
} from '@kitbag/core-design';
import { cleanName, useSongLibrary, type LibraryRow } from '@kitbag/core-state';
import { useCallback, useMemo, useRef, useState } from 'react';
import { View, type TextInput } from 'react-native';

import { replaceText } from '../logic/notices.ts';

const useStyles = createThemedStyles(() => ({
  stack: { gap: space.controlGap },
  row: { flexDirection: 'row', gap: space.controlGap },
}));

type Kind = 'none' | 'import' | 'actions' | 'rename' | 'delete';

export function useLibraryMenu() {
  const [kind, setKind] = useState<Kind>('none');
  const [target, setTarget] = useState<LibraryRow | null>(null);
  const openImport = useCallback(() => {
    setKind('import');
  }, []);
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
      openImport,
      openActions,
      openRename,
      openDelete,
      close,
    }),
    [kind, target, openImport, openActions, openRename, openDelete, close],
  );
}

export type LibraryMenu = ReturnType<typeof useLibraryMenu>;

interface SheetProps {
  readonly menu: LibraryMenu;
  readonly bottomInset: number;
}

function ImportSheet({ menu, bottomInset }: SheetProps) {
  const styles = useStyles();
  const importSong = useSongLibrary((s) => s.importSong);
  const importStemFolder = useSongLibrary((s) => s.importStemFolder);
  const { close } = menu;
  const pickFile = useCallback(() => {
    close();
    void importSong();
  }, [close, importSong]);
  const pickFolder = useCallback(() => {
    close();
    void importStemFolder();
  }, [close, importStemFolder]);
  return (
    <Sheet
      visible={menu.kind === 'import'}
      title="Import"
      dismissLabel="Close Import"
      bottomInset={bottomInset}
      onDismiss={close}
    >
      <View style={styles.stack}>
        <Button
          icon="song"
          label="Song file"
          variant="primary"
          onPress={pickFile}
        />
        <Button
          icon="stems"
          label="Stem song folder"
          variant="tonal"
          onPress={pickFolder}
        />
      </View>
      <SheetHint>
        An audio file becomes a song. A StemDeck song bundle, as a .zip or its
        extracted folder, becomes a stem song.
      </SheetHint>
    </Sheet>
  );
}

function ActionsSheet({ menu, bottomInset }: SheetProps) {
  const styles = useStyles();
  const reanalyze = useSongLibrary((s) => s.reanalyze);
  const { target, close, openRename, openDelete } = menu;
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
      <View style={styles.stack}>
        <Button label="Rename" variant="tonal" onPress={openRename} />
        {target?.kind === 'song' ? (
          <Button label="Re-analyze" variant="tonal" onPress={retry} />
        ) : null}
        <Button
          label={target?.kind === 'stems' ? 'Delete stem song' : 'Delete song'}
          variant="destructive"
          onPress={openDelete}
        />
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
  const cancel = useSongLibrary((s) => s.cancelReplace);
  const confirm = useCallback(() => {
    void confirmReplace();
  }, [confirmReplace]);
  const title = prompt?.title ?? '';
  return (
    <Sheet
      visible={prompt !== null}
      title={`Replace “${title}”?`}
      dismissLabel="Keep the current song"
      bottomInset={bottomInset}
      onDismiss={cancel}
    >
      <SheetHint>{replaceText(prompt?.name ?? '', title)}</SheetHint>
      <View style={styles.row}>
        <Button fill variant="ghost" label="Keep current" onPress={cancel} />
        <Button
          fill
          variant="destructive"
          label="Replace"
          accessibilityLabel={`Replace ${title}`}
          onPress={confirm}
        />
      </View>
    </Sheet>
  );
}

export function LibrarySheets(props: SheetProps) {
  return (
    <>
      <ImportSheet {...props} />
      <ActionsSheet {...props} />
      <RenameSheet {...props} />
      <DeleteSheet {...props} />
      <ReplaceSheet bottomInset={props.bottomInset} />
    </>
  );
}
