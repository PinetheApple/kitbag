import {
  Button,
  createThemedStyles,
  Sheet,
  SheetHint,
  space,
} from '@kitbag/core-design';
import {
  useNotificationPermission,
  type NotificationReason,
} from '@kitbag/core-state';
import { useCallback } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CLOSE } from '@/settings/settingsLabels';

const useStyles = createThemedStyles(() => ({
  actions: { flexDirection: 'row', gap: space.controlGap },
}));

const NOT_NOW = 'Not now';

const WORDS: Readonly<
  Record<NotificationReason, { readonly title: string; readonly hint: string }>
> = {
  playback: {
    title: 'Show the playback card?',
    hint: 'Allow notifications to control playback from the shade and the lock screen.',
  },
  import: {
    title: 'Show import progress?',
    hint: 'Allow notifications to see songs coming in after you leave Kitbag, and when they are done.',
  },
};

export function NotificationPromptSheet() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const prompting = useNotificationPermission((s) => s.prompting);
  const words = WORDS[useNotificationPermission((s) => s.reason)];
  const allow = useNotificationPermission((s) => s.allow);
  const notNow = useNotificationPermission((s) => s.notNow);
  const handleAllow = useCallback(() => {
    void allow();
  }, [allow]);
  return (
    <Sheet
      visible={prompting}
      title={words.title}
      dismissLabel={CLOSE}
      bottomInset={insets.bottom}
      onDismiss={notNow}
    >
      <SheetHint>{words.hint}</SheetHint>
      <View style={styles.actions}>
        <Button fill variant="ghost" label={NOT_NOW} onPress={notNow} />
        <Button fill variant="primary" label="Allow" onPress={handleAllow} />
      </View>
    </Sheet>
  );
}
