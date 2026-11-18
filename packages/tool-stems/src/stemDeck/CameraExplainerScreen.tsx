import { AppBar, Button, EmptyState } from '@kitbag/core-design';
import { useStemDeck } from '@kitbag/core-state';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';

import { SCAN_TITLE, TYPE_ADDRESS, useScanLook } from './scanLook.ts';
import { useStemDeckStyles, type StemDeckInsets } from './stemDeckStyles.ts';

const REASON =
  'Kitbag uses the camera only to read the QR code. Nothing is recorded or saved.';
const BLOCKED_REASON =
  'Android won’t ask again. Turn on the camera for Kitbag in its settings, then come back. Kitbag uses it only to read the QR code.';

export interface CameraExplainerScreenProps {
  readonly insets: StemDeckInsets;
  readonly onBack: () => void;
}

export function CameraExplainerScreen({
  insets,
  onBack,
}: CameraExplainerScreenProps) {
  const styles = useStemDeckStyles();
  const blocked = useStemDeck((s) => s.camera === 'blocked');
  const scanAddress = useStemDeck((s) => s.scanAddress);
  const openCameraSettings = useStemDeck((s) => s.openCameraSettings);
  const typeAddress = useStemDeck((s) => s.typeAddress);
  const look = useScanLook();
  const allow = useCallback(() => {
    void scanAddress(look, !blocked).then((answer) => {
      if (answer === 'granted') onBack();
      else if (blocked) openCameraSettings();
    });
  }, [scanAddress, look, blocked, onBack, openCameraSettings]);
  const typeInstead = useCallback(() => {
    typeAddress();
    onBack();
  }, [typeAddress, onBack]);
  const frame = useMemo(
    () => [styles.screen, { paddingTop: insets.top }],
    [styles.screen, insets.top],
  );
  const content = useMemo(
    () => [styles.body, { paddingBottom: insets.bottom }],
    [styles.body, insets.bottom],
  );
  return (
    <View style={frame}>
      <AppBar flush title={SCAN_TITLE} onBack={onBack} />
      <View style={content}>
        <EmptyState
          variant="list"
          icon="qrScan"
          title="Scan the code in StemDeck"
          reason={blocked ? BLOCKED_REASON : REASON}
          actionLabel={blocked ? 'Open settings' : 'Allow camera'}
          option={null}
          onAction={allow}
        />
        <Button
          variant="ghost"
          size="target"
          label={TYPE_ADDRESS}
          onPress={typeInstead}
        />
      </View>
    </View>
  );
}
