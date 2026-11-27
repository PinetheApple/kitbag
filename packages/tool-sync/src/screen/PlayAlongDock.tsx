import {
  PlayerDock,
  PlayPauseButton,
  stemPlayer,
  TransportKey,
} from '@kitbag/core-design';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { usePlayAlong } from './playAlongHooks.ts';

const PLAYING = 1;
const STOPPED = 0;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: stemPlayer.transportGap,
  },
});

export interface PlayAlongDockProps {
  readonly playing: boolean;
  readonly disabled: boolean;
  readonly bottomInset: number;
}

export function PlayAlongDock({
  playing,
  disabled,
  bottomInset,
}: PlayAlongDockProps) {
  const previous = usePlayAlong((s) => s.previous);
  const playPause = usePlayAlong((s) => s.playPause);
  const next = usePlayAlong((s) => s.next);
  const shown = useSharedValue(playing ? PLAYING : STOPPED);

  useEffect(() => {
    shown.value = playing ? PLAYING : STOPPED;
  }, [playing, shown]);

  return (
    <PlayerDock bottomInset={bottomInset}>
      <View style={styles.row}>
        <TransportKey
          size="dock"
          icon="previous"
          disabled={disabled}
          accessibilityLabel="Previous track"
          onPress={previous}
        />
        <PlayPauseButton
          size="dock"
          playing={shown}
          disabled={disabled}
          playLabel="Play the song"
          pauseLabel="Pause the song"
          onPress={playPause}
        />
        <TransportKey
          size="dock"
          icon="next"
          disabled={disabled}
          accessibilityLabel="Next track"
          onPress={next}
        />
      </View>
    </PlayerDock>
  );
}
