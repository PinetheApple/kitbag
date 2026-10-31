import {
  Button,
  createThemedStyles,
  hitBoxStyle,
  hitExtension,
  iconSizes,
  InlineIcon,
  metronome,
  metronomeSheet,
  minTouchTargetDp,
  SheetHint,
  size,
  space,
  textRoles,
  textStyle,
  unshared,
  type IconName,
} from '@kitbag/core-design';
import {
  isLoadedSongUnsaved,
  loadedPresetOf,
  useLibrary,
  useMetronome,
} from '@kitbag/core-state';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { guarded, type ErrorSetter } from '../library/sheets.tsx';
import { UNSAVED_CHANGES } from '../logic/setlistChip.ts';

const ROW_ROOM = (metronomeSheet.songRow - metronomeSheet.nowAction) / 2;
const ROW_ACTION_HIT_BOX = hitBoxStyle(
  hitExtension(minTouchTargetDp, metronomeSheet.nowAction, {
    top: unshared(ROW_ROOM),
    bottom: unshared(ROW_ROOM),
  }),
);

const useStyles = createThemedStyles((theme) => ({
  dot: {
    width: metronome.unsavedDot,
    height: metronome.unsavedDot,
    borderRadius: metronome.unsavedDot / 2,
    flexShrink: 0,
    backgroundColor: theme.color[theme.accentInk],
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: metronome.unsavedDotGap,
  },
  noteText: {
    ...textStyle(textRoles.setlistSongMeta),
    color: theme.color.text,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: space.controlGap,
  },
  rowAction: {
    minHeight: metronomeSheet.nowAction,
    flexDirection: 'row',
    alignItems: 'center',
    gap: metronomeSheet.nowActionIconGap,
    borderRadius: metronomeSheet.nowActionRadius,
    borderWidth: size.stroke,
  },
  rowRevert: {
    paddingHorizontal: metronomeSheet.nowActionRevertH,
    borderColor: theme.color.line,
  },
  rowSave: {
    paddingHorizontal: metronomeSheet.nowActionSaveH,
    borderColor: theme.color.accent,
    backgroundColor: theme.color.accent,
  },
  rowLabel: {
    ...textStyle(textRoles.nowAction),
  },
  rowIcon: {
    fontSize: iconSizes.action,
  },
  rowRevertInk: {
    color: theme.color.text2,
  },
  rowSaveInk: {
    color: theme.color.onAccent,
  },
}));

export function useLoadedSongUnsaved(): boolean {
  const preset = useLibrary(loadedPresetOf);
  return useMetronome(
    (live) => preset !== undefined && isLoadedSongUnsaved(preset, live),
  );
}

export function UnsavedDot() {
  const styles = useStyles();
  return <View style={styles.dot} />;
}

export function UnsavedNote() {
  const styles = useStyles();
  return (
    <View style={styles.note}>
      <UnsavedDot />
      <Text style={styles.noteText}>{UNSAVED_CHANGES}</Text>
    </View>
  );
}

export const SAVE_FAILED = 'Could not save the song. Try again.';

function useSaveRevert(onError: ErrorSetter) {
  const save = useLibrary((s) => s.saveLoadedSong);
  const revert = useLibrary((s) => s.revertLoadedSong);
  const handleSave = useCallback(() => {
    void guarded(onError, SAVE_FAILED, save);
  }, [onError, save]);
  return { handleSave, revert };
}

interface RowActionProps {
  readonly icon: IconName;
  readonly label: string;
  readonly spoken: string;
  readonly primary: boolean;
  readonly onPress: () => void;
}

function RowAction({ icon, label, spoken, primary, onPress }: RowActionProps) {
  const styles = useStyles();
  const ink = primary ? styles.rowSaveInk : styles.rowRevertInk;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      style={ROW_ACTION_HIT_BOX}
      onPress={onPress}
    >
      <View
        style={[styles.rowAction, primary ? styles.rowSave : styles.rowRevert]}
      >
        <InlineIcon name={icon} style={[styles.rowIcon, ink]} />
        <Text style={[styles.rowLabel, ink]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const REVERT = {
  icon: 'reset',
  label: 'Revert',
  spoken: 'Revert to the saved song',
} as const;
const SAVE = {
  icon: 'saveInto',
  label: 'Save',
  spoken: 'Save changes to the song',
} as const;

export function NowRowActions({ onError }: { readonly onError: ErrorSetter }) {
  const { handleSave, revert } = useSaveRevert(onError);
  return (
    <>
      <RowAction {...REVERT} primary={false} onPress={revert} />
      <RowAction {...SAVE} primary onPress={handleSave} />
    </>
  );
}

export function SheetSaveRevert() {
  const styles = useStyles();
  const [error, setError] = useState<string | null>(null);
  const { handleSave, revert } = useSaveRevert(setError);
  return (
    <>
      <View style={styles.sheetActions}>
        <Button
          variant="ghost"
          size="sheet"
          icon={REVERT.icon}
          label={REVERT.label}
          accessibilityLabel={REVERT.spoken}
          fill
          onPress={revert}
        />
        <Button
          variant="primary"
          size="sheet"
          icon={SAVE.icon}
          label={SAVE.label}
          accessibilityLabel={SAVE.spoken}
          fill
          onPress={handleSave}
        />
      </View>
      {error === null ? null : <SheetHint>{error}</SheetHint>}
    </>
  );
}
