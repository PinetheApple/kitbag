import {
  Button,
  createThemedStyles,
  Sheet,
  SheetHint,
  space,
} from '@kitbag/core-design';
import { useNotificationPermission } from '@kitbag/core-state';
import { useCallback } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CLOSE } from '@/settings/settingsLabels';

const useStyles = createThemedStyles(() => ({
  actions: { flexDirection: 'row', gap: space.controlGap },
}));

const NOT_NOW = 'Not now';

export function NotificationPromptSheet() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const prompting = useNotificationPermission((s) => s.prompting);
  const allow = useNotificationPermission((s) => s.allow);
  const notNow = useNotificationPermission((s) => s.notNow);
  const handleAllow = useCallback(() => {
    void allow();
  }, [allow]);
  return (
    <Sheet
      visible={prompting}
      title="Show the playback card?"
      dismissLabel={CLOSE}
      bottomInset={insets.bottom}
      onDismiss={notNow}
    >
      <SheetHint>
        Allow notifications to control playback from the shade and the lock
        screen.
      </SheetHint>
      <View style={styles.actions}>
        <Button fill variant="ghost" label={NOT_NOW} onPress={notNow} />
        <Button fill variant="primary" label="Allow" onPress={handleAllow} />
      </View>
    </Sheet>
  );
}
