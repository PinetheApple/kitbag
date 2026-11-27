import {
  Button,
  createThemedStyles,
  EditRow,
  EditValue,
  Sheet,
  SheetHint,
  space,
  TextField,
} from '@kitbag/core-design';
import { hasGetSongBpmKey, useGetSongBpmKey } from '@kitbag/core-state';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GET_A_KEY_LABEL,
  GET_SONG_BPM_KEY_LABEL,
  KEY_CREDIT,
  KEY_CREDIT_TEXT,
  KEY_PLACEHOLDER,
  KEY_PRIVACY_HINT,
  KEY_SET,
  KEY_SHEET_HINT,
  REMOVE_KEY,
  SAVE_KEY,
  SAVED_KEY_LABEL,
} from './getSongBpmKeyText.ts';
import { openUrl } from './openUrl.ts';
import { CLOSE } from './settingsLabels.ts';

const useStyles = createThemedStyles(() => ({
  stack: { gap: space.controlGap },
  actions: { flexDirection: 'row', gap: space.controlGap },
}));

function CreditRow() {
  const openCredit = useCallback(() => {
    openUrl(KEY_CREDIT.url);
  }, []);
  return (
    <EditRow
      label={GET_A_KEY_LABEL}
      accessibilityRole="link"
      accessibilityLabel={`${GET_A_KEY_LABEL}, ${KEY_CREDIT.url}`}
      onPress={openCredit}
    >
      <EditValue muted>{KEY_CREDIT_TEXT}</EditValue>
    </EditRow>
  );
}

interface KeyActionsProps {
  readonly draft: string;
  readonly hasSavedKey: boolean;
  readonly onDone: () => void;
}

function KeyActions({ draft, hasSavedKey, onDone }: KeyActionsProps) {
  const styles = useStyles();
  const setKey = useGetSongBpmKey((s) => s.setKey);
  const removeKey = useGetSongBpmKey((s) => s.removeKey);
  const save = useCallback(() => {
    setKey(draft);
    onDone();
  }, [setKey, draft, onDone]);
  const remove = useCallback(() => {
    removeKey();
    onDone();
  }, [removeKey, onDone]);
  return (
    <View style={styles.actions}>
      {hasSavedKey ? (
        <Button
          fill
          variant="destructive"
          label={REMOVE_KEY}
          onPress={remove}
        />
      ) : null}
      <Button
        fill
        variant="primary"
        label={SAVE_KEY}
        disabled={!hasGetSongBpmKey(draft.trim())}
        onPress={save}
      />
    </View>
  );
}

export interface GetSongBpmKeySheetProps {
  readonly visible: boolean;
  readonly onDismiss: () => void;
}

export function GetSongBpmKeySheet({
  visible,
  onDismiss,
}: GetSongBpmKeySheetProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const hasSavedKey = useGetSongBpmKey((s) => hasGetSongBpmKey(s.key));
  const [draft, setDraft] = useState('');
  const clearDraft = useCallback(() => {
    setDraft('');
  }, []);
  const dismiss = useCallback(() => {
    setDraft('');
    onDismiss();
  }, [onDismiss]);
  return (
    <Sheet
      visible={visible}
      title={GET_SONG_BPM_KEY_LABEL}
      dismissLabel={CLOSE}
      bottomInset={insets.bottom}
      onDismiss={dismiss}
    >
      <View style={styles.stack}>
        <SheetHint>{KEY_SHEET_HINT}</SheetHint>
        <CreditRow />
        {hasSavedKey ? (
          <EditRow label={SAVED_KEY_LABEL}>
            <EditValue>{KEY_SET}</EditValue>
          </EditRow>
        ) : null}
        <TextField
          value={draft}
          onChangeText={setDraft}
          placeholder={KEY_PLACEHOLDER}
          accessibilityLabel={GET_SONG_BPM_KEY_LABEL}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          secureTextEntry
          importantForAutofill="no"
        />
        <SheetHint>{KEY_PRIVACY_HINT}</SheetHint>
        <KeyActions
          draft={draft}
          hasSavedKey={hasSavedKey}
          onDone={clearDraft}
        />
      </View>
    </Sheet>
  );
}
