import { useCallback, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { stemPlayer } from '../stemPlayerRoles.ts';
import { PlayPauseButton } from './PrimaryPlayButton.tsx';
import { TransportKey } from './TransportKey.tsx';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: stemPlayer.transportGap,
  },
});

export interface PlayerTransportProps {
  readonly playing: SharedValue<number>;
  readonly loopActive: boolean;
  readonly loopLabel: string;
  readonly skipSeconds: number;
  readonly onLoop: () => void;
  readonly onSkip: (seconds: number) => void;
  readonly onTogglePlay: () => void;
  readonly extraKey?: ReactNode;
}

export function PlayerTransport({
  playing,
  loopActive,
  loopLabel,
  skipSeconds,
  onLoop,
  onSkip,
  onTogglePlay,
  extraKey,
}: PlayerTransportProps) {
  const back = useCallback(() => {
    onSkip(-skipSeconds);
  }, [onSkip, skipSeconds]);
  const forward = useCallback(() => {
    onSkip(skipSeconds);
  }, [onSkip, skipSeconds]);
  return (
    <View style={styles.row}>
      <TransportKey
        size="dock"
        icon="repeat"
        selected={loopActive}
        accessibilityLabel={loopLabel}
        onPress={onLoop}
      />
      <TransportKey
        size="dock"
        icon="skipBack"
        accessibilityLabel={`Back ${String(skipSeconds)} seconds`}
        onPress={back}
      />
      <PlayPauseButton
        size="dock"
        playing={playing}
        playLabel="Play"
        pauseLabel="Pause"
        onPress={onTogglePlay}
      />
      <TransportKey
        size="dock"
        icon="skipForward"
        accessibilityLabel={`Forward ${String(skipSeconds)} seconds`}
        onPress={forward}
      />
      {extraKey}
    </View>
  );
}
