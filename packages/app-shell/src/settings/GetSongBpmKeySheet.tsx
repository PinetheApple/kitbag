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
  KEY_SHEET_HINT,
  maskedKey,
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

function KeyActions({ draft }: { readonly draft: string }) {
  const styles = useStyles();
  const savedKey = useGetSongBpmKey((s) => s.key);
  const setKey = useGetSongBpmKey((s) => s.setKey);
  const removeKey = useGetSongBpmKey((s) => s.removeKey);
  const save = useCallback(() => {
    setKey(draft);
  }, [setKey, draft]);
  return (
    <View style={styles.actions}>
      {hasGetSongBpmKey(savedKey) ? (
        <Button
          fill
          variant="destructive"
          label={REMOVE_KEY}
          onPress={removeKey}
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
  const savedKey = useGetSongBpmKey((s) => s.key);
  const [draft, setDraft] = useState('');
  const [shownKey, setShownKey] = useState(savedKey);
  if (shownKey !== savedKey) {
    setShownKey(savedKey);
    setDraft('');
  }
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
        {hasGetSongBpmKey(savedKey) ? (
          <EditRow label={SAVED_KEY_LABEL}>
            <EditValue>{maskedKey(savedKey)}</EditValue>
          </EditRow>
        ) : null}
        <TextField
          value={draft}
          onChangeText={setDraft}
          placeholder={KEY_PLACEHOLDER}
          accessibilityLabel={GET_SONG_BPM_KEY_LABEL}
        />
        <SheetHint>{KEY_PRIVACY_HINT}</SheetHint>
        <KeyActions draft={draft} />
      </View>
    </Sheet>
  );
}
