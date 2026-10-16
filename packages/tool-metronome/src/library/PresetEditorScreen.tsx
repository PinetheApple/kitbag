import {
  AppBar,
  Button,
  Chip,
  EmptyState,
  createThemedStyles,
  space,
  SheetHint,
  StatusPill,
} from '@kitbag/core-design';
import { useLibrary, type SongPreset } from '@kitbag/core-state';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import type { ShellMeasuredInsets } from '../screen/MetronomeScreen.tsx';
import { IdentityGroup, MusicGroup } from './editor/MusicGroup.tsx';
import { RigGroup } from './editor/RigGroup.tsx';
import { usePresetEditor } from './editor/usePresetEditor.ts';
import { ScreenFrame } from './ScreenFrame.tsx';
import { ConfirmSheet, guarded, useFire } from './sheets.tsx';
import { useLibraryRefresh } from './useLibraryRefresh.ts';

const useStyles = createThemedStyles(() => ({
  actions: { flexDirection: 'row', gap: space.controlGap },
}));

export interface PresetEditorScreenProps {
  readonly presetId: number;
  readonly insets: ShellMeasuredInsets;
  readonly onBack: () => void;
  readonly onOpenPreset: (presetId: number) => void;
  readonly onDirtyChange?: (dirty: boolean) => void;
}

type Confirm = 'none' | 'delete';

function useEditorCommands(props: PresetEditorScreenProps) {
  const [confirm, setConfirm] = useState<Confirm>('none');
  const [error, setError] = useState<string | null>(null);
  const duplicatePreset = useLibrary((s) => s.duplicatePreset);
  const deletePreset = useLibrary((s) => s.deletePreset);
  const { presetId, onBack, onOpenPreset } = props;
  const close = useCallback(() => {
    setConfirm('none');
    setError(null);
  }, []);
  const askDelete = useCallback(() => {
    setConfirm('delete');
    setError(null);
  }, []);
  const duplicate = useCallback(
    () =>
      guarded(
        setError,
        'Could not duplicate this song. Try again.',
        async () => {
          onOpenPreset(await duplicatePreset(presetId));
        },
      ),
    [duplicatePreset, presetId, onOpenPreset],
  );
  const destroy = useCallback(
    () =>
      guarded(setError, 'Could not delete this song. Try again.', async () => {
        await deletePreset(presetId);
        setConfirm('none');
        onBack();
      }),
    [deletePreset, presetId, onBack],
  );
  return {
    confirm,
    error,
    close,
    askDelete,
    duplicate,
    destroy,
    setError,
  };
}

function EditorBody(
  props: PresetEditorScreenProps & { readonly preset: SongPreset },
) {
  const { preset } = props;
  const styles = useStyles();
  const editor = usePresetEditor(preset);
  const cmd = useEditorCommands(props);
  const { onDirtyChange } = props;
  useEffect(() => {
    onDirtyChange?.(editor.dirty);
    return () => {
      onDirtyChange?.(false);
    };
  }, [editor.dirty, onDirtyChange]);
  const save = useCallback(
    () =>
      guarded(
        cmd.setError,
        'Could not save your changes. Try again.',
        editor.save,
      ),
    [cmd, editor],
  );
  const fireSave = useFire(save);
  const fireDuplicate = useFire(cmd.duplicate);

  const trailing = editor.dirty ? (
    <Chip active label="Save" onPress={fireSave} />
  ) : (
    <StatusPill label="Saved" />
  );
  const common = { bottomInset: props.insets.bottom, onDismiss: cmd.close };
  return (
    <ScreenFrame
      insets={props.insets}
      header={
        <AppBar
          title={editor.draft.name}
          onBack={props.onBack}
          trailing={trailing}
        />
      }
    >
      <IdentityGroup editor={editor} />
      <MusicGroup editor={editor} />
      <RigGroup editor={editor} bottomInset={props.insets.bottom} />
      {cmd.error === null ? null : <SheetHint>{cmd.error}</SheetHint>}
      <View style={styles.actions}>
        <Button
          fill
          variant="ghost"
          label="Duplicate"
          onPress={fireDuplicate}
        />
        <Button fill variant="ghost" label="Delete" onPress={cmd.askDelete} />
      </View>
      <ConfirmSheet
        {...common}
        visible={cmd.confirm === 'delete'}
        title="Delete song?"
        body={`“${preset.name}” is deleted from All songs and from every setlist. This cannot be undone.`}
        confirmLabel="Delete song"
        destructive
        error={cmd.error}
        onConfirm={cmd.destroy}
      />
    </ScreenFrame>
  );
}

export function PresetEditorScreen(props: PresetEditorScreenProps) {
  useLibraryRefresh();
  const ready = useLibrary((s) => s.ready);
  const preset = useLibrary((s) =>
    s.presets.find((p) => p.id === props.presetId),
  );
  if (preset !== undefined)
    return <EditorBody key={preset.id} {...props} preset={preset} />;
  if (!ready) return null;
  return (
    <ScreenFrame
      insets={props.insets}
      header={<AppBar title="Song not found" onBack={props.onBack} />}
    >
      <EmptyState
        icon="song"
        title="Song not found"
        reason="This song may have been deleted from another screen."
        actionLabel="Go back"
        onAction={props.onBack}
      />
    </ScreenFrame>
  );
}
