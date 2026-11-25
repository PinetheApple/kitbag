import {
  Button,
  createThemedStyles,
  Sheet,
  SheetHint,
  space,
  TextField,
} from '@kitbag/core-design';
import { customSoundId } from '@kitbag/core-native';
import {
  cleanName,
  useClickSounds,
  type ClickSound,
  type PerAccentSounds,
  rolesUsing,
} from '@kitbag/core-state';
import { useCallback, useMemo, useRef, useState } from 'react';
import { View, type TextInputInstance } from 'react-native';

import {
  optionsHint,
  removeText,
  removeTitle,
} from '../logic/customSoundText.ts';

const useStyles = createThemedStyles(() => ({
  stack: { gap: space.controlGap },
  row: { flexDirection: 'row', gap: space.controlGap },
}));

type MenuKind = 'none' | 'options' | 'rename' | 'remove';

export function useCustomSoundMenu() {
  const [kind, setKind] = useState<MenuKind>('none');
  const [target, setTarget] = useState<ClickSound | null>(null);
  const open = useCallback((sound: ClickSound) => {
    setTarget(sound);
    setKind('options');
  }, []);
  const openRename = useCallback(() => {
    setKind('rename');
  }, []);
  const openRemove = useCallback(() => {
    setKind('remove');
  }, []);
  const close = useCallback(() => {
    setKind('none');
  }, []);
  return useMemo(
    () => ({ kind, target, open, openRename, openRemove, close }),
    [kind, target, open, openRename, openRemove, close],
  );
}

export type CustomSoundMenu = ReturnType<typeof useCustomSoundMenu>;

interface SheetProps {
  readonly menu: CustomSoundMenu;
  readonly bottomInset: number;
}

function OptionsSheet({ menu, bottomInset }: SheetProps) {
  const styles = useStyles();
  const importPicked = useClickSounds((s) => s.importPicked);
  const { target, close, openRename, openRemove } = menu;
  const name = target?.name ?? '';
  const replace = useCallback(() => {
    close();
    if (target !== null) void importPicked(target);
  }, [close, importPicked, target]);
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
          onPress={openRemove}
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

export interface CustomSoundSheetsProps extends SheetProps {
  readonly sounds: PerAccentSounds;
  readonly onRemoved?: (id: number) => void;
}

function RemoveSheet({
  menu,
  bottomInset,
  sounds,
  onRemoved,
}: CustomSoundSheetsProps) {
  const styles = useStyles();
  const remove = useClickSounds((s) => s.remove);
  const { target, close } = menu;
  const name = target?.name ?? '';
  const confirm = useCallback(() => {
    close();
    if (target === null) return;
    const id = customSoundId(target.slot);
    void remove(target.slot).then(() => {
      onRemoved?.(id);
    });
  }, [close, target, remove, onRemoved]);
  const roles =
    target === null ? [] : rolesUsing(sounds, customSoundId(target.slot));
  return (
    <Sheet
      visible={menu.kind === 'remove'}
      title={removeTitle(name)}
      dismissLabel="Cancel remove"
      bottomInset={bottomInset}
      dim
      onDismiss={close}
    >
      <SheetHint>{removeText(roles)}</SheetHint>
      <View style={styles.row}>
        <Button fill variant="ghost" label="Cancel" onPress={close} />
        <Button
          fill
          variant="destructive"
          label="Remove"
          accessibilityLabel={`Remove ${name}`}
          onPress={confirm}
        />
      </View>
    </Sheet>
  );
}

export function CustomSoundSheets(props: CustomSoundSheetsProps) {
  return (
    <>
      <OptionsSheet menu={props.menu} bottomInset={props.bottomInset} />
      <RenameSheet menu={props.menu} bottomInset={props.bottomInset} />
      <RemoveSheet {...props} />
    </>
  );
}
