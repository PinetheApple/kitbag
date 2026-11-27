import {
  PlayerDock,
  PlayPauseButton,
  PrimaryPlayButton,
  stemPlayer,
  TransportKey,
} from '@kitbag/core-design';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { usePlayAlong } from './playAlongHooks.ts';
import { usePlayingValue } from './usePlayingValue.ts';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: stemPlayer.transportGap,
  },
});

export function ClickDock({ bottomInset }: { readonly bottomInset: number }) {
  const clickPlaying = usePlayAlong((s) => s.clickPlaying);
  const startClick = usePlayAlong((s) => s.startClick);
  const stopClick = usePlayAlong((s) => s.stopClick);
  const start = useCallback(() => {
    try {
      startClick();
    } catch {
      return;
    }
  }, [startClick]);
  return (
    <PlayerDock bottomInset={bottomInset}>
      <View style={styles.row}>
        <PrimaryPlayButton
          size="dock"
          glyph={clickPlaying ? 'stop' : 'play'}
          accessibilityLabel={
            clickPlaying ? 'Stop the click' : 'Start the click'
          }
          onPress={clickPlaying ? stopClick : start}
        />
      </View>
    </PlayerDock>
  );
}

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
  const shown = usePlayingValue(playing);

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
