import {
  Button,
  createThemedStyles,
  QUEUE_TEXT,
  removedText,
  Sheet,
  SheetHint,
  space,
  TextField,
  TimedSnackbar,
} from '@kitbag/core-design';
import { customSoundId } from '@kitbag/core-native';
import {
  cleanName,
  useClickSounds,
  withSoundRestored,
  type ClickSound,
  type PerAccentSounds,
  type SoundsUpdate,
} from '@kitbag/core-state';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { View, type TextInputInstance } from 'react-native';

import { optionsHint } from '../logic/customSoundText.ts';

const useStyles = createThemedStyles(() => ({
  stack: { gap: space.controlGap },
  row: { flexDirection: 'row', gap: space.controlGap },
}));

type MenuKind = 'none' | 'options' | 'rename';

export function useCustomSoundMenu() {
  const [kind, setKind] = useState<MenuKind>('none');
  const [target, setTarget] = useState<ClickSound | null>(null);
  const [removedFrom, setRemovedFrom] = useState<PerAccentSounds | null>(null);
  const open = useCallback((sound: ClickSound) => {
    setTarget(sound);
    setKind('options');
  }, []);
  const openRename = useCallback(() => {
    setKind('rename');
  }, []);
  const close = useCallback(() => {
    setKind('none');
  }, []);
  return useMemo(
    () => ({
      kind,
      target,
      removedFrom,
      open,
      openRename,
      close,
      setRemovedFrom,
    }),
    [kind, target, removedFrom, open, openRename, close],
  );
}

export type CustomSoundMenu = ReturnType<typeof useCustomSoundMenu>;

interface SheetProps {
  readonly menu: CustomSoundMenu;
  readonly bottomInset: number;
}

export interface CustomSoundSheetsProps extends SheetProps {
  readonly sounds: PerAccentSounds;
  readonly onRemoved?: (id: number) => void;
}

function useRemoveSound({ menu, sounds, onRemoved }: CustomSoundSheetsProps) {
  const remove = useClickSounds((s) => s.remove);
  const { target, close, setRemovedFrom } = menu;
  return useCallback(() => {
    close();
    if (target === null) return;
    const id = customSoundId(target.slot);
    setRemovedFrom(sounds);
    void remove(target.slot).then(() => {
      onRemoved?.(id);
    });
  }, [close, target, setRemovedFrom, sounds, remove, onRemoved]);
}

function OptionsSheet(props: CustomSoundSheetsProps) {
  const { menu, bottomInset } = props;
  const styles = useStyles();
  const importPicked = useClickSounds((s) => s.importPicked);
  const { target, close, openRename } = menu;
  const name = target?.name ?? '';
  const replace = useCallback(() => {
    close();
    if (target !== null) void importPicked(target);
  }, [close, importPicked, target]);
  const removeSound = useRemoveSound(props);
  return (
    <Sheet
      visible={menu.kind === 'options'}
      title={name}
      dismissLabel={`Close options for ${name}`}
      bottomInset={bottomInset}
      dim
      onDismiss={close}
    >
      <View style={styles.stack}>
        <Button label="Rename" variant="tonal" onPress={openRename} />
        <Button label="Replace" variant="tonal" onPress={replace} />
        <Button
          label="Remove sound"
          variant="destructive"
          onPress={removeSound}
        />
      </View>
      <SheetHint>{optionsHint(name)}</SheetHint>
    </Sheet>
  );
}

function RenameSheet({ menu, bottomInset }: SheetProps) {
  const styles = useStyles();
  const rename = useClickSounds((s) => s.rename);
  const { target, close } = menu;
  const name = target?.name ?? '';
  const [draft, setDraft] = useState(name);
  const field = useRef<TextInputInstance>(null);
  const cleaned = cleanName(draft);
  const prefill = useCallback(() => {
    setDraft(name);
  }, [name]);
  const focusField = useCallback(() => {
    field.current?.focus();
  }, []);
  const clear = useCallback(() => {
    setDraft('');
    focusField();
  }, [focusField]);
  const save = useCallback(() => {
    if (target === null || cleaned === null) return;
    close();
    void rename(target.slot, cleaned);
  }, [target, cleaned, close, rename]);
  return (
    <Sheet
      visible={menu.kind === 'rename'}
      title="Rename sound"
      dismissLabel="Cancel rename"
      bottomInset={bottomInset}
      dim
      onShow={prefill}
      onShown={focusField}
      onDismiss={close}
    >
      <TextField
        ref={field}
        value={draft}
        onChangeText={setDraft}
        placeholder="Sound name"
        accessibilityLabel={`New name for ${name}`}
        onSubmitEditing={save}
        onClear={clear}
      />
      <View style={styles.row}>
        <Button fill variant="ghost" label="Cancel" onPress={close} />
        <Button
          fill
          variant="primary"
          label="Save"
          disabled={cleaned === null}
          accessibilityLabel={`Save the new name for ${name}`}
          onPress={save}
        />
      </View>
    </Sheet>
  );
}

export function CustomSoundSheets(props: CustomSoundSheetsProps) {
  return (
    <>
      <OptionsSheet {...props} />
      <RenameSheet menu={props.menu} bottomInset={props.bottomInset} />
    </>
  );
}

export function useRemovedSoundNotice(
  menu: CustomSoundMenu,
  onRestored?: (update: SoundsUpdate) => void,
): ReactNode {
  const removed = useClickSounds((s) => s.removed);
  const undoRemove = useClickSounds((s) => s.undoRemove);
  const dismissRemoved = useClickSounds((s) => s.dismissRemoved);
  const { removedFrom } = menu;
  const undo = useCallback(() => {
    if (removed === null) return;
    const id = customSoundId(removed.sound.slot);
    void undoRemove().then((restored) => {
      if (restored && removedFrom !== null)
        onRestored?.((current) => withSoundRestored(current, removedFrom, id));
    });
  }, [removed, undoRemove, removedFrom, onRestored]);
  const dismiss = useCallback(() => {
    void dismissRemoved();
  }, [dismissRemoved]);
  if (removed === null) return undefined;
  return (
    <TimedSnackbar
      inline
      at={removed.at}
      message={removedText(removed.sound.name)}
      actionLabel={QUEUE_TEXT.undo}
      onAction={undo}
      onTimeout={dismiss}
    />
  );
}
