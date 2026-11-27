import {
  Button,
  ButtonRow,
  createThemedStyles,
  rowLabel,
  Sheet,
  stemPlayer,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import type { SaveRefusal } from '@kitbag/core-state';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import {
  SAVE_REFUSAL_TEXT,
  saveRows,
  TEMPO_NOT_SAVED,
  type SaveRow,
} from '../logic/saveForSong.ts';
import { usePlayAlong } from './playAlongHooks.ts';

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: stemPlayer.menuRowGap,
    minHeight: stemPlayer.menuRowMinHeight,
  },
  label: {
    ...textStyle(textRoles.menuRow),
    flex: 1,
    minWidth: 0,
    color: theme.color.text,
  },
  value: {
    ...textStyle(textRoles.menuValue),
    textAlign: 'right',
    color: theme.color.text2,
  },
  refusal: {
    ...textStyle(textRoles.fieldLabel),
    color: theme.color.redInk,
  },
}));

function FieldRow({ label, value }: SaveRow) {
  const styles = useStyles();
  return (
    <View
      accessible
      accessibilityLabel={rowLabel(label, value)}
      style={styles.row}
    >
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function useSave(onSaved: () => void) {
  const saveForTrack = usePlayAlong((s) => s.saveForTrack);
  const [refusal, setRefusal] = useState<SaveRefusal | undefined>();
  const clear = useCallback(() => {
    setRefusal(undefined);
  }, []);
  const save = useCallback(() => {
    void saveForTrack().then((outcome) => {
      if (outcome.saved) onSaved();
      else setRefusal(outcome.reason);
    });
  }, [saveForTrack, onSaved]);
  return { refusal, clear, save };
}

export interface SaveSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

export function SaveSheet({ visible, bottomInset, onDismiss }: SaveSheetProps) {
  const styles = useStyles();
  const lock = usePlayAlong((s) => s.lock);
  const pattern = usePlayAlong((s) => s.pattern);
  const { refusal, clear, save } = useSave(onDismiss);
  return (
    <Sheet
      visible={visible && lock !== undefined}
      title="Save for this song"
      titleIcon="saveInto"
      hint={TEMPO_NOT_SAVED}
      dismissLabel="Close save for this song"
      bottomInset={bottomInset}
      onShow={clear}
      onDismiss={onDismiss}
      footer={
        <ButtonRow>
          <Button
            fill
            size="sheet"
            variant="ghost"
            label="Cancel"
            onPress={onDismiss}
          />
          <Button
            fill
            size="sheet"
            variant="primary"
            label="Save"
            onPress={save}
          />
        </ButtonRow>
      }
    >
      <View>
        {lock === undefined
          ? null
          : saveRows(pattern, lock.track, lock.phaseOffsetMs).map((row) => (
              <FieldRow key={row.label} {...row} />
            ))}
      </View>
      {refusal === undefined ? null : (
        <Text accessibilityLiveRegion="polite" style={styles.refusal}>
          {SAVE_REFUSAL_TEXT[refusal]}
        </Text>
      )}
    </Sheet>
  );
}
